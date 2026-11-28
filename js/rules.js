// What each class feature, archetype ability, class choice (and its powers), mythic ability, feat and racial trait
// needs at the table: a uses counter (rage rounds, channel energy, ki pool...), the dice its Use button rolls, the
// uses of another ability it spends, and bonuses (always on, or switched on while they apply).
// data/rules/features.json is built by tools/build_rules.js from an audit of every item in the rules data.
// Entries: { k: kind, o: owner, c: class formula variable, n: name, r: { uses, roll, cost, bonuses, note } }
(function () {
  'use strict';
  const ver = (document.querySelector('script[src*="js/rules.js"]') || { src: '' }).src.split('?v=')[1] || '1';
  // Same idea as the sheet's featureKey: "Rage (25 rounds/day)" -> "rage", "Sneak attack +3d6" -> "sneak attack"
  const key = n => String(n || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s*\([^)]*\)/g, '').replace(/\s*[+−-]?\d+(d\d+)?(\/day|st|nd|rd|th)?\b.*$/i, '').replace(/[,:;.]+$/, '').replace(/s$/, '').trim();
  const lc = s => String(s || '').toLowerCase().trim();
  let list = null, byName = new Map(), byUid = new Map(), loading = null;
  const uid = e => `${e.k}|${lc(e.o)}|${lc(e.n)}`;
  function index(data) {
    list = Array.isArray(data) ? data : [];
    byName = new Map(); byUid = new Map();
    for (const e of list) {
      const k = key(e.n);
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(e);
      byUid.set(uid(e), e);
    }
  }
  function load() {
    if (list) return Promise.resolve(list);
    if (!loading) loading = fetch(`data/rules/features.json?v=${ver}`).then(r => (r.ok ? r.json() : [])).then(d => { index(d); return list; }).catch(() => { index([]); return list; });
    return loading;
  }
  // Order a name-only match prefers when several classes share a name
  const ORDER = ['class', 'archetype', 'choice-power', 'choice', 'choice-pick', 'mythic', 'feat', 'race'];
  // q: { name, kind?, owner?, cls?, classes?: [class slugs], archetypes?: [names] }
  function find(q) {
    if (!list || !q || !q.name) return null;
    let cands = byName.get(key(q.name)) || [];
    if (!cands.length) { const k2 = key(String(q.name).replace(/\s*\(.*$/, '')); cands = byName.get(k2) || []; }
    if (!cands.length) return null;
    if (q.kind) {
      const owner = lc(q.owner);
      const same = cands.filter(e => e.k === q.kind || (q.kind === 'choice-power' && e.k === 'choice-pick') || (q.kind === 'choice-pick' && e.k === 'choice-power'));
      const exact = owner ? same.find(e => lc(e.o) === owner || (q.kind === 'choice' && lc(e.o).endsWith('/ ' + owner))) : null;
      if (exact) return exact;
      const byCls = q.cls ? same.find(e => e.c === q.cls) : null;
      if (byCls) return byCls;
      if (same.length && !owner) return same[0];
    }
    const classes = new Set(q.classes || []), archs = new Set((q.archetypes || []).map(lc));
    const ok = e => (e.k === 'mythic' || e.k === 'feat' || e.k === 'race') ? true : e.k === 'archetype' ? archs.has(lc(e.o)) || classes.has(e.c) : classes.has(e.c);
    const pool = cands.filter(ok);
    pool.sort((a, b) => ORDER.indexOf(a.k) - ORDER.indexOf(b.k));
    if (q.kind) { const k = pool.find(e => e.k === q.kind); if (k) return k; }
    return pool[0] || null;
  }
  window.PF_RULES = { load, find, key, uid, byUid: u => byUid.get(u) || null, loaded: () => !!list, count: () => (list ? list.length : 0) };
})();
