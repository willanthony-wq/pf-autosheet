// Pathfinder Reference Document lookups (Open Game Content, see OGL.txt).
// Data files in data/srd/ are built by tools/build_srd.py and loaded only when a tab needs them.
(() => {
  'use strict';
  const KINDS = ['feats', 'traits', 'spells', 'items', 'gear', 'weapons', 'armor', 'classes', 'archetypes', 'choices'];
  const cache = {}, pending = {};
  const ver = (document.querySelector('script[src*="js/srd.js"]') || { src: '' }).src.split('?v=')[1] || '1';

  const CUSTOM = '(Custom)', USE_SRD = '(Use SRD list)';
  const key = s => String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

  function load(kind) {
    if (cache[kind]) return Promise.resolve(cache[kind]);
    if (!pending[kind]) {
      pending[kind] = fetch(`data/srd/${kind}.json?v=${ver}`).then(r => {
        if (!r.ok) throw new Error(`${kind}: ${r.status}`);
        return r.json();
      }).then(raw => {
        const list = Array.isArray(raw) ? raw : Object.values(raw);
        const map = new Map();
        list.forEach(x => { const k = key(x.n); if (!map.has(k)) map.set(k, x); });
        cache[kind] = { list, map };
        return cache[kind];
      }).catch(err => { delete pending[kind]; console.warn('SRD data not loaded', err); return null; });
    }
    return pending[kind];
  }
  const ensure = kinds => Promise.all(kinds.map(load));

  // Name variants: "+1 longsword" -> "longsword", "composite longbow" -> "longbow, composite",
  // "masterwork chain shirt" -> "chain shirt", "Cloak of Resistance +2" -> "cloak of resistance".
  function variants(name) {
    const k = key(name);
    const out = [k];
    let base = k.replace(/^\+\d+\s+/, '').replace(/\s+\+\d+$/, '').replace(/^(masterwork|mwk|cold iron|silver|alchemical silver|adamantine|mithral|darkwood)\s+/, '')
      .replace(/\s*\(\d+\)$/, '').replace(/\s*\((empty|per day|1 day|each)\)$/, '').trim();
    out.push(base);
    const words = base.split(' ');
    if (words.length === 2) out.push(`${words[1]}, ${words[0]}`);
    if (words.length === 3) out.push(`${words[1]} ${words[2]}, ${words[0]}`, `${words[2]}, ${words[0]} ${words[1]}`);
    if (/s$/.test(base)) out.push(base.replace(/s$/, ''));
    // Hero Lab spellings: "Rope, hempen (50 ft.)" -> "Rope, hemp (50 ft.)"
    if (/\bhempen\b/.test(base)) out.push(base.replace(/\bhempen\b/, 'hemp'));
    out.push(base + ' (empty)');
    // "Skill Focus (Stealth)", "Weapon Focus (longsword)" -> the feat itself
    const noDetail = base.replace(/\s*\([^)]*\)$/, '').trim();
    if (noDetail && noDetail !== base) out.push(noDetail);
    return [...new Set(out)];
  }
  function find(kind, name) {
    const c = cache[kind];
    if (!c || !String(name || '').trim()) return null;
    for (const v of variants(name)) { const hit = c.map.get(v); if (hit) return hit; }
    return null;
  }
  // First kind (in order) that knows the name.
  function findAny(kinds, name) {
    for (const k of kinds) { const hit = find(k, name); if (hit) return { kind: k, item: hit }; }
    return null;
  }
  const enhOf = name => { const m = String(name || '').match(/(?:^|\s)\+(\d)\b/); return m ? +m[1] : 0; };
  // Price of an item; magic items list one price per "+N".
  function priceOf(it, name) {
    if (it.cost !== undefined) return it.cost;
    if (Array.isArray(it.p)) {
      const plus = enhOf(name);
      const hit = it.p.find(([, label]) => label === '+' + plus) || it.p[0];
      return hit ? hit[0] : null;
    }
    return typeof it.p === 'number' ? it.p : null;
  }

  // <datalist> elements for name suggestions, created once their data has loaded.
  // Browsers show at most about 500 suggestions, so a list holds only the names that match what is typed
  // (refreshed by narrow() as you type), names starting with the typed text first.
  const LIMIT = 400;
  const full = {};   // datalist id -> [{ n, k }]
  const shown = {};  // datalist id -> query the list was last built for
  const optHtml = n => `<option value="${String(n).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}">`;
  function datalist(id, kinds, filter) {
    if (document.getElementById(id)) return;
    ensure(kinds).then(res => {
      if (document.getElementById(id)) return;
      const seen = new Set(), names = [];
      res.forEach(c => c && c.list.forEach(x => {
        if (filter && !filter(x)) return;
        const k = key(x.n);
        if (seen.has(k)) return;
        seen.add(k);
        names.push({ n: x.n, k });
      }));
      full[id] = names;
      const dl = document.createElement('datalist');
      dl.id = id;
      document.body.appendChild(dl);
      shown[id] = null;
      const active = document.activeElement;
      narrow(id, active && active.getAttribute && active.getAttribute('list') === id ? active.value : '');
    });
  }
  function narrow(id, query) {
    const dl = document.getElementById(id), names = full[id];
    if (!dl || !names) return;
    const q = key(query);
    if (shown[id] === q) return;
    shown[id] = q;
    let list = names;
    if (q) {
      const starts = [], words = [], inside = [];
      for (const x of names) {
        const i = x.k.indexOf(q);
        if (i === 0) starts.push(x);
        else if (i > 0) (x.k[i - 1] === ' ' || x.k[i - 1] === '(' ? words : inside).push(x);
      }
      list = starts.concat(words, inside);
    }
    // First entry: type your own entry with no autofill
    dl.innerHTML = (q ? '' : `<option value="${CUSTOM}" label="Type your own (no autofill)">`) + list.slice(0, LIMIT).map(x => optHtml(x.n)).join('');
  }

  // Features gained by level for a class: [{ name, level, base }], with repeating numbered features
  // (Sneak attack +1d6, +2d6 ...) collapsed to the latest one and repeated picks counted.
  function classFeatures(className, level) {
    const c = cache.classes;
    if (!c) return null;
    const cls = c.map.get(key(className)) || c.map.get(key(String(className).replace(/\s*\(.*\)\s*$/, '')));
    if (!cls) return null;
    const byBase = new Map();
    cls.levels.slice(0, Math.max(0, level)).forEach((feats, li) => feats.forEach(f => {
      const base = f.replace(/\s*[+−-]?\d+(d\d+)?(\/day|st|nd|rd|th)?\b.*$/i, '').replace(/\s*\(.*\)$/, '').trim() || f;
      const k = base.toLowerCase();
      const cur = byBase.get(k) || { base, count: 0, name: f, level: li + 1, first: li + 1 };
      cur.count += 1; cur.name = f; cur.level = li + 1;
      byBase.set(k, cur);
    }));
    const desc = b => {
      const k = b.toLowerCase();
      const hit = cls.f[k] || cls.f[k.replace(/s$/, '')] || cls.f[k + 's'] || Object.values(cls.f).find(x => x.n.toLowerCase().startsWith(k));
      return hit ? hit.d : '';
    };
    return { cls, features: [...byBase.values()].map(x => ({
      name: x.count > 1 && x.name.toLowerCase() === x.base.toLowerCase() ? `${x.base} (×${x.count})` : x.name,
      base: x.base, level: x.level, first: x.first, text: desc(x.base),
    })) };
  }
  // Archetypes of a class ("Paladin" or "Paladin (Hospitaler)" -> paladin's list), and one by name
  const classKey = n => key(String(n || '').replace(/\s*\(.*\)\s*$/, ''));
  function archetypesFor(className) {
    const c = cache.archetypes;
    return c ? c.list.filter(a => a.c === classKey(className)).sort((x, y) => x.n.localeCompare(y.n)) : [];
  }
  function archetype(className, name) { return archetypesFor(className).find(a => key(a.n) === key(name)) || null; }
  // Class choices (domains, bloodlines, talents...). Some classes choose from another class's list.
  const SHARED_CHOICES = {
    inquisitor: [['cleric', 'Domain'], ['cleric', 'Subdomain']], druid: [['cleric', 'Domain']], ninja: [['rogue', 'Rogue talent'], ['rogue', 'Advanced talent']],
    slayer: [['rogue', 'Rogue talent']], skald: [['barbarian', 'Rage power']], samurai: [['cavalier', 'Order']], antipaladin: [],
  };
  function choicesFor(className) {
    const c = cache.choices;
    if (!c) return [];
    const k = classKey(className);
    const shared = SHARED_CHOICES[k] || [];
    return c.list.filter(x => x.c === k || shared.some(([sc, g]) => x.c === sc && x.g === g));
  }
  function choice(className, group, name) { return choicesFor(className).find(x => x.g === group && key(x.n) === key(name)) || null; }
  // Description of a class feature from any class (the character's classes first).
  function classFeatureText(name, classNames) {
    const c = cache.classes;
    if (!c) return '';
    const k = key(name).replace(/\s*[+−-]?\d.*$/, '').replace(/\s*\(.*\)$/, '').trim();
    const order = (classNames || []).map(n => c.map.get(key(n)) || c.map.get(key(String(n).replace(/\s*\(.*\)\s*$/, '')))).filter(Boolean).concat(c.list);
    for (const cls of order) {
      const hit = cls.f[k] || cls.f[k.replace(/s$/, '')];
      if (hit) return hit.d;
    }
    return '';
  }

  window.PF_SRD = { CUSTOM, USE_SRD, KINDS, load, ensure, narrow, archetypesFor, archetype, choicesFor, choice, find, findAny, priceOf, enhOf, datalist, classFeatures, classFeatureText, key, loaded: k => !!cache[k] };
})();
