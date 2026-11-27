// Hero Lab (Pathfinder 1e) import: reads a portfolio (.por, a zip) or a statblock XML export and builds a character.
// After building it, the sheet's own math is compared with Hero Lab's totals; small differences (an oversized weapon,
// a bonus the sheet doesn't model) become misc adjustments, and each one is listed for the player to check.
(() => {
  'use strict';
  const D = window.PF_DATA, M = window.PF_MODEL;

  // ---------- tiny XML reader (Hero Lab output is plain, well-formed XML)
  function decode(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()];
    });
  }
  function parseXml(src) {
    const root = { tag: '#root', attrs: {}, kids: [], text: '' }, stack = [root];
    const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(src))) {
      const top = stack[stack.length - 1];
      if (m[1] !== undefined) { top.text += m[1]; continue; }
      if (m[3]) {
        if (m[2] === '/') { if (stack.length > 1) stack.pop(); continue; }
        const el = { tag: m[3], attrs: {}, kids: [], text: '' };
        m[4].replace(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (_, k, a, b) => { el.attrs[k] = decode(a !== undefined ? a : b); return ''; });
        top.kids.push(el);
        if (!m[5]) stack.push(el);
        continue;
      }
      if (m[6] !== undefined) top.text += decode(m[6]);
    }
    return root;
  }
  const kid = (el, tag) => (el && el.kids.find(k => k.tag === tag)) || null;
  const kids = (el, tag) => (el ? el.kids.filter(k => !tag || k.tag === tag) : []);
  function all(el, tag, out = []) { for (const k of (el ? el.kids : [])) { if (k.tag === tag) out.push(k); all(k, tag, out); } return out; }
  const at = (el, a) => (el && el.attrs[a] !== undefined ? el.attrs[a] : '');
  const txt = el => (el ? el.text.trim() : '');
  const num = v => { const x = parseFloat(String(v || '').replace(/[^\d.+-]/g, '')); return Number.isFinite(x) ? x : 0; };
  const firstNum = v => { const m = String(v || '').match(/[-+]?\d+/); return m ? parseInt(m[0], 10) : null; };
  const lc = s => String(s || '').toLowerCase().trim();

  // ---------- names
  const ALIGN = { 'lawful good': 'LG', 'neutral good': 'NG', 'chaotic good': 'CG', 'lawful neutral': 'LN', 'neutral': 'N', 'true neutral': 'N',
    'chaotic neutral': 'CN', 'lawful evil': 'LE', 'neutral evil': 'NE', 'chaotic evil': 'CE' };
  const ABIL = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
  const SLOT = { head: 'head', headband: 'headband', eyes: 'face/eyes', face: 'face/eyes', neck: 'throat', throat: 'throat', shoulders: 'shoulders',
    body: 'body', chest: 'torso', torso: 'torso', wrists: 'arms', wrist: 'arms', arms: 'arms', hands: 'hands', belt: 'waist', waist: 'waist', feet: 'feet', ring: 'ring' };
  function skillName(hl) {
    const m = String(hl).match(/^Knowledge \((.+)\)$/i);
    if (m) { const k = m[1].trim().replace(/^the\s+/i, ''); return 'Kn. ' + k.charAt(0).toUpperCase() + k.slice(1).toLowerCase(); }
    return hl;
  }
  const SPECIALTY = { craft: 'Craft:', perform: 'Perform:', profession: 'Prof:', artistry: 'Artistry:', lore: 'Lore:' };
  function findClass(name) {
    const n = lc(name);
    return D.classes.find(c => lc(c.name) === n) || D.classes.find(c => lc(c.name) === n.replace(/\s*\(.*\)$/, '')) || null;
  }
  function archetypesIn(className) {
    const m = String(className || '').match(/\(([^)]+)\)\s*$/);
    return m ? m[1].split(/\s*[,/]\s*/).map(x => x.trim()).filter(x => x && !/^(unchained|core)$/i.test(x)).map(x => x.replace(/\w/g, ch => ch.toUpperCase())) : [];
  }
  function stripItem(name) { return lc(name).replace(/^\+\d+\s+/, '').replace(/^(masterwork|mwk)\s+/, '').replace(/\s*\(.*\)$/, '').trim(); }
  const MATERIAL_WORDS = /\b(mithral|adamantine|darkwood|dragonhide|cold iron|alchemical silver|silver|elysian bronze|angelskin|eel hide|griffon mane|living steel|bulette)\b/g;
  function findArmor(table, name) {
    const n = stripItem(name).replace(MATERIAL_WORDS, '').replace(/\s+/g, ' ').trim(), words = n.split(/\s+/);
    const tries = [n, words.length === 2 ? `${words[1]} ${words[0]}` : null, n.replace(/ armor$/, ''), n.replace(/ shield$/, '') + ' shield'].filter(Boolean);
    for (const t of tries) { const hit = table.find(a => lc(a.name) === t); if (hit) return hit; }
    if (table === D.shields) {
      if (/tower/.test(n)) return table.find(s => /tower/i.test(s.name));
      if (/heavy/.test(n)) return table.find(s => /heavy/i.test(s.name));
      if (/light/.test(n)) return table.find(s => /light shield/i.test(s.name));
      if (/buckler/.test(n)) return table.find(s => /buckler/i.test(s.name));
    }
    return null;
  }
  const enhOf = name => { const m = String(name).match(/(?:^|\s)\+(\d)\b/); return m ? m[1] : (/\b(masterwork|mwk)\b/i.test(name) ? 'Mwk' : '0'); };
  function crit(text) {
    const t = String(text || '').replace(/×/g, 'x');
    const m = t.match(/(\d+)-20/), x = t.match(/x\s*(\d)/i);
    return { crit: m ? `${m[1]}-20` : '20', mult: 'x' + (x ? x[1] : '2') };
  }
  const opt = (cat, part) => (cat ? cat.options.find(o => o.label.includes(part)) : null) || (cat ? cat.options[0] : null);

  // ---------- one character from a statblock XML document
  function convert(xmlText, statText) {
    const doc = parseXml(xmlText);
    const C = all(doc, 'character')[0];
    if (!C) throw new Error('No character found. Use a Hero Lab portfolio (.por) or a Hero Lab XML export.');
    const ch = M.normalize(M.blankCharacter());
    const warnings = [];
    ch.source = 'herolab';

    // Identity
    const personal = kid(C, 'personal');
    Object.assign(ch.info, {
      name: at(C, 'name'), player: at(C, 'playername'),
      alignment: ALIGN[lc(at(kid(C, 'alignment'), 'name'))] || at(kid(C, 'alignment'), 'name'),
      race: (r => r.charAt(0).toUpperCase() + r.slice(1))(at(kid(C, 'race'), 'racetext') || at(kid(C, 'race'), 'name')),
      deity: at(kid(C, 'deity'), 'name'), gender: at(personal, 'gender'), ageYears: at(personal, 'age'),
      height: at(kid(personal, 'charheight'), 'text'), weight: at(kid(personal, 'charweight'), 'text'),
      xp: num(at(kid(C, 'xp'), 'total')),
    });
    const size = at(kid(C, 'size'), 'name');
    if (M.SIZES.some(s => s.name === size)) ch.info.size = size;
    ch.notes = [txt(kid(personal, 'description')), ...kids(kid(C, 'journals'), 'journal').map(j => txt(kid(j, 'description')) || txt(j))].filter(Boolean).join('\n\n');
    ch.languages = kids(kid(C, 'languages'), 'language').map(l => at(l, 'name')).join(', ');

    // Classes
    const cls = kids(kid(C, 'classes'), 'class');
    ch.classes = cls.map(c => {
      const hit = findClass(at(c, 'name'));
      if (!hit) warnings.push(`Class "${at(c, 'name')}" isn't in the sheet's class list. Pick the closest one on the Character tab.`);
      return { name: hit ? hit.name : '', level: num(at(c, 'level')), archetypes: archetypesIn(at(c, 'name')) };
    });
    while (ch.classes.length < 3) ch.classes.push({ name: '', level: 0 });
    const archSet = ch.classes.filter(c => (c.archetypes || []).length).map(c => `${c.name}: ${c.archetypes.join(', ')}`);
    if (archSet.length) warnings.push(`Archetype set: ${archSet.join('; ')}. The class features came from Hero Lab already; "Add for my level" on the Features & Gear tab can fill in any that are missing.`);

    // Abilities: Hero Lab's base already includes racial modifiers, so the race's ability modifiers stay at 0.
    for (const a of kids(kid(C, 'attributes'), 'attribute')) {
      const k = ABIL[lc(at(a, 'name'))];
      if (!k) continue;
      const v = kid(a, 'attrvalue');
      ch.abilities[k].base = num(at(v, 'base'));
    }
    const target = {};
    for (const a of kids(kid(C, 'attributes'), 'attribute')) {
      const k = ABIL[lc(at(a, 'name'))];
      if (k) target[k] = num(at(kid(a, 'attrvalue'), 'modified'));
    }

    // Health
    const h = kid(C, 'health');
    ch.hp.damage = num(at(h, 'damage')); ch.hp.nonlethal = num(at(h, 'nonlethal'));
    const dr = all(kid(C, 'damagereduction'), 'special').map(s => at(s, 'shortname')).filter(Boolean);
    if (dr.length) ch.hp.dr = 'DR ' + dr.join(', ');
    const res = [...kids(kid(C, 'resistances'), 'special'), ...kids(kid(C, 'immunities'), 'special')].map(s => at(s, 'shortname') || at(s, 'name'));
    if (res.length) ch.hp.resist = res.join(', ');
    const hpTarget = num(at(h, 'hitpoints'));

    // Money
    const money = kid(C, 'money');
    for (const k of ['pp', 'gp', 'sp', 'cp']) ch.money[k] = num(at(money, k));

    // Speed (Hero Lab's base speed already includes things like fast movement)
    const base = kid(kid(C, 'movement'), 'basespeed');
    if (base) ch.info.speeds.base = num(at(base, 'value'));

    // Armor and shield
    const defs = kids(kid(C, 'defenses'), 'armor').filter(a => at(a, 'equipped') === 'yes' && at(a, 'natural') !== 'yes');
    const usedNames = new Set();
    for (const a of defs) {
      const name = at(a, 'name'), isShield = /shield|buckler/i.test(name) || /shield/i.test(txt(kid(a, 'itemslot')));
      const table = isShield ? D.shields : D.armor, hit = findArmor(table, name);
      const slot = isShield ? ch.shield : ch.armor;
      slot.name = name; slot.enh = enhOf(name) === 'Mwk' ? 'Mwk' : num(enhOf(name));
      slot.weight = num(at(kid(a, 'weight'), 'value')) || '';
      if (hit) slot.item = hit.name; else warnings.push(`${isShield ? 'Shield' : 'Armor'} "${name}" isn't in the sheet's table. Choose it on the Combat tab.`);
      const mat = D.materials.find(m => m.name && name.toLowerCase().includes(m.name.toLowerCase()));
      if (mat) slot.material = mat.name;
      usedNames.add(lc(name));
    }

    // Weapons
    const melee = kids(kid(C, 'melee'), 'weapon'), ranged = kids(kid(C, 'ranged'), 'weapon');
    const catM = D.attackCategories.find(c => c.name.startsWith('Melee Attack')), catR = D.attackCategories.find(c => c.name.startsWith('Ranged Attack'));
    const wTargets = [];
    const addWeapon = (w, isRanged) => {
      const name = at(w, 'name'), dmg = at(w, 'damage'), cr = crit(at(w, 'crit'));
      const thrown = /thrown/i.test(at(w, 'categorytext'));
      const enh = enhOf(name);
      const out = Object.assign(M.blankWeapon(), {
        name, enh, dice: (dmg.match(/\d+d\d+/) || [''])[0], crit: cr.crit, mult: cr.mult, type: at(w, 'typetext'),
        weight: (num(at(kid(w, 'weight'), 'value')) * Math.max(1, num(at(w, 'quantity')))) || '', carried: true,
      });
      const bonus = firstNum(dmg.replace(/^\d+d\d+/, '')) || 0;
      if (isRanged) {
        const ra = kid(w, 'rangedattack');
        out.range = String(at(ra, 'rangeincvalue') || '').replace(/'/g, '') ? String(at(ra, 'rangeincvalue')).replace(/'/g, '') + ' ft' : '';
        out.category = catR.name;
        const usesStr = thrown || (/composite|sling/i.test(name) && bonus > num(enh));
        out.formula = opt(catR, usesStr ? 'STR to Damage' : 'DEX to hit (').label;
        wTargets.push({ atk: firstNum(at(ra, 'attack') || at(w, 'attack')), dmg: bonus, hasDmg: /\d+d\d+/.test(dmg) });
      } else if (at(w, 'equipped') === 'offhand') {
        const catO = D.attackCategories.find(c => c.name.startsWith('Off-Hand Melee'));
        out.category = catO.name;
        out.formula = opt(catO, 'Standard Off-Hand').label;
        wTargets.push({ atk: firstNum(at(w, 'attack')), dmg: bonus, hasDmg: /\d+d\d+/.test(dmg) });
      } else {
        out.category = catM.name;
        out.formula = opt(catM, at(w, 'equipped') === 'bothhands' ? 'Two-Handed Melee' : 'Standard Melee').label;
        wTargets.push({ atk: firstNum(at(w, 'attack')), dmg: bonus, hasDmg: /\d+d\d+/.test(dmg) });
      }
      if (at(w, 'size') && at(w, 'size') !== '(M)') out.name = `${name} ${at(w, 'size')}`;
      ch.weapons.push(out);
      usedNames.add(lc(name));
    };
    melee.forEach(w => addWeapon(w, false));
    ranged.forEach(w => addWeapon(w, true));

    // Skills
    for (const s of kids(kid(C, 'skills'), 'skill')) {
      const hl = at(s, 'name'), ranks = num(at(s, 'ranks'));
      const sp = hl.match(/^(Craft|Perform|Profession|Artistry|Lore)\s*\((.+)\)$/i);
      if (sp) {
        if (!ranks) continue;
        const baseName = SPECIALTY[lc(sp[1])];
        let row = ch.specialty.find(r => r.base === baseName && !r.detail);
        if (!row) { row = { base: baseName, detail: '', ranks: 0, misc: 0 }; ch.specialty.push(row); }
        row.detail = sp[2]; row.ranks = ranks; row._hl = num(at(s, 'value'));
        continue;
      }
      const name = skillName(hl);
      if (!D.skillMeta[name]) { if (ranks) warnings.push(`Skill "${hl}" isn't on the sheet (${ranks} ranks).`); continue; }
      ch.skills[name] = { ranks, misc: 0 };
      if (at(s, 'classskill') === 'yes') ch.skills[name].classSkill = true;
      ch.skills[name]._hl = num(at(s, 'value'));
    }

    // Feats, traits, drawbacks
    const suggest = (kind, name) => (window.PF_FEATS ? window.PF_FEATS.suggest(kind, name, Object.keys(D.skillMeta)) || [] : []);
    for (const f of kids(kid(C, 'feats'), 'feat')) {
      if (at(f, 'profgroup') === 'yes') continue;   // armor and weapon proficiencies granted by the class
      const name = at(f, 'name').replace(/\s+[-+]\d+\/[-+]\d+$/, '');   // 'Power Attack -3/+6' -> 'Power Attack'
      ch.feats.push({ level: '', name, text: txt(kid(f, 'description')), bonuses: suggest('feat', name) });
    }
    for (const t of kids(kid(C, 'traits'), 'trait')) ch.traits.push({ kind: 'Trait', text: `${at(t, 'name')}: ${txt(kid(t, 'description'))}`, bonuses: suggest('trait', at(t, 'name')) });
    for (const t of kids(kid(C, 'flaws'), 'flaw')) ch.traits.push({ kind: 'Drawback', text: `${at(t, 'name')}: ${txt(kid(t, 'description'))}`, bonuses: [] });

    // Class features and other special abilities (every <special>, except spell-like abilities)
    const seen = new Set(), sla = new Set(all(kid(C, 'spelllike'), 'special'));
    for (const s of all(C, 'special')) {
      if (sla.has(s)) continue;
      const name = (at(s, 'shortname') || at(s, 'name')).replace(/\s*\((Ex|Su|Sp)\)$/, '');
      if (!name || seen.has(lc(at(s, 'name')))) continue;
      seen.add(lc(at(s, 'name')));
      if (/^Damage Reduction/i.test(at(s, 'name')) || /^\d+\/./.test(name)) continue;   // shown as DR
      ch.classFeatures.push({ name: at(s, 'name').replace(/\s*\((Ex|Su|Sp)\)$/, ''), text: txt(kid(s, 'description')), bonuses: [] });
    }
    // Rage as a switchable effect
    const rageName = [...seen].find(n => /^(mighty |greater )?rage\b/.test(n));
    if (rageName) {
      const b = /mighty/.test(rageName) || ch.classFeatures.some(f => /mighty rage/i.test(f.name)) ? 8 : ch.classFeatures.some(f => /greater rage/i.test(f.name)) ? 6 : 4;
      ch.effects.unshift({ id: M.uid(), name: 'Rage', type: 'Morale', active: false, v: { str: b, con: b, will: b / 2, ac: -2 }, text: '' });
    }

    // Spell-like abilities
    for (const s of all(kid(C, 'spelllike'), 'special')) {
      const name = at(s, 'shortname') || at(s, 'name');
      const g = /(\d+)\/day/i.test(name) ? (name.match(/(\d+)\/day/i)[1] === '1' ? 0 : 1) : /constant/i.test(name) ? 3 : 2;
      ch.spellcasting.sla[g].items.push({ id: M.uid(), name: name.replace(/\s*\((Sp)\)$/, ''), uses: '', notes: txt(kid(s, 'description')).slice(0, 200) });
    }

    // Spells: memorized if any, otherwise known
    const spellClass = kids(kid(C, 'spellclasses'), 'spellclass')[0];
    const caster = cls.find(c => num(at(c, 'casterlevel')) > 0);
    if (spellClass || caster) {
      const hit = findClass(at(spellClass, 'name') || at(caster, 'name'));
      if (hit) { ch.spellcasting.className = hit.name; if (hit.stat) ch.spellcasting.ability = hit.stat.toLowerCase(); }
    }
    const spellEls = kids(kid(C, 'spellsmemorized'), 'spell').length ? kids(kid(C, 'spellsmemorized'), 'spell') : kids(kid(C, 'spellsknown'), 'spell');
    // Which spells are prepared (and how many times) is only in the text statblock: "2nd—paladin's sacrifice (3, DC 20), shield other (2)"
    const prepared = preparedFromText(statText);
    const leftByLevel = {}, prepByLevel = {};
    for (const s of spellEls) {
      const L = Math.min(9, Math.max(0, num(at(s, 'level'))));
      const lv = ch.spellcasting.levels[L];
      const raw = at(s, 'name'), xm = raw.match(/\s*\(x(\d+)\)$/);
      const name = raw.replace(/\s*\(x\d+\)$/, '');
      if (lv.spells.some(x => x.name === name)) continue;
      const count = prepared ? (prepared.get(spellKey(name)) || 0) : 0;
      lv.spells.push({ id: M.uid(), name, prepared: count ? 'x'.repeat(count) : '', save: at(s, 'save') && !/^none/i.test(at(s, 'save')) ? at(s, 'save').replace(/^DC \d+\s*/i, '') : '', duration: at(s, 'duration') });
      if (count) { prepByLevel[L] = (prepByLevel[L] || 0) + count; leftByLevel[L] = (leftByLevel[L] || 0) + Math.min(count, num(at(s, 'castsleft'))); }
    }
    // Spells already cast today count as used
    for (const L of Object.keys(prepByLevel)) ch.spellcasting.levels[L].used = Math.max(0, prepByLevel[L] - leftByLevel[L]);

    // Worn magic items, other gear and resources
    const wornRows = ch.slots;
    const itemText = el => txt(kid(el, 'description'));
    for (const it of kids(kid(C, 'magicitems'), 'item')) {
      const name = at(it, 'name'), slot = SLOT[lc(txt(kid(it, 'itemslot')))];
      if (usedNames.has(lc(name))) continue;   // weapons and armor are already on the Combat tab
      if (slot) {
        let row = wornRows.find(r => r.slot === slot && !String(r.item || '').trim());
        if (!row) { row = { slot, item: '', text: '', bonuses: [] }; wornRows.push(row); }
        row.item = name; row.text = itemText(it);
        let b = suggest('item', name);
        // Belts and headbands that name their abilities, e.g. "Belt of physical might +2 (Str, Con)"
        const picks = (name.match(/\(([^)]+)\)/) || [])[1];
        if (picks && b.length) {
          const keys = picks.split(/[,/]/).map(x => lc(x).slice(0, 3)).filter(k => ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(k));
          if (keys.length) { const tpl = b[0]; b = keys.map(k => Object.assign({}, tpl, { target: k, text: '' })); }
        }
        row.bonuses = b;
        continue;
      }
      ch.inventory.push(invItem(it));
    }
    const weaponNames = new Set([...melee, ...ranged].map(w => stripItem(at(w, 'name'))));
    for (const it of kids(kid(C, 'gear'), 'item')) {
      if (weaponNames.has(stripItem(at(it, 'name'))) || usedNames.has(lc(at(it, 'name')))) continue;
      ch.inventory.push(invItem(it));
    }
    function invItem(it) {
      const qty = Math.max(1, num(at(it, 'quantity')));
      return { name: at(it, 'name'), qty, weight: num(at(kid(it, 'weight'), 'value')) || '', value: Math.round(num(at(kid(it, 'cost'), 'value')) / qty * 100) / 100 || '', carried: true, notes: '' };
    }
    ch.resources = kids(kid(C, 'trackedresources'), 'trackedresource').map(r => ({ name: at(r, 'name'), uses: num(at(r, 'left')), max: num(at(r, 'max')) }));
    const hero = kid(C, 'heropoints');
    if (at(hero, 'enabled') === 'yes') ch.heroPoints.current = num(at(hero, 'total'));
    if (all(kid(C, 'minions'), 'character').length) warnings.push('Companions (animal companions, familiars, eidolons) aren\'t imported. Add them on the Companion tab.');

    activeEffects(ch, C, [...melee, ...ranged].map(w => at(w, 'attack')), warnings);
    const saveT = {};
    for (const sv of kids(kid(C, 'saves'), 'save')) { const k = lc(at(sv, 'abbr')); if (['fort', 'ref', 'will'].includes(k)) saveT[k] = firstNum(at(sv, 'save')); }
    calibrate(ch, {
      hpTarget, target, wTargets, saves: saveT, init: firstNum(at(kid(C, 'initiative'), 'total')), ac: num(at(kid(C, 'armorclass'), 'ac')) || null,
      cmb: firstNum(at(kid(C, 'maneuvers'), 'cmb')), cmd: firstNum(at(kid(C, 'maneuvers'), 'cmd')),
      spells: (() => {
        const sc = kids(kid(C, 'spellclasses'), 'spellclass')[0];
        if (!sc) return null;
        const perDay = {};
        for (const l of kids(sc, 'spelllevel')) if (num(at(l, 'maxcasts')) > 0) perDay[num(at(l, 'level'))] = num(at(l, 'maxcasts'));
        const cl = Math.max(0, ...kids(kid(C, 'classes'), 'class').map(c => num(at(c, 'casterlevel'))));
        return { perDay, cl };
      })(),
      load: { 'light load': 'Light', 'medium load': 'Medium', 'heavy load': 'Heavy', overloaded: 'Overloaded' }[lc(at(kid(C, 'encumbrance'), 'level'))] || null,
      carried: at(kid(C, 'encumbrance'), 'carried'), speed: num(at(kid(kid(C, 'movement'), 'speed'), 'value')) || null,
    }, warnings);
    return { character: ch, warnings };
  }

  // Spell names compared loosely: "Restoration, Lesser" = "lesser restoration"
  function spellKey(n) {
    let k = lc(n).replace(/\[[^\]]*\]/g, '').replace(/\s*\(.*\)$/, '').trim();
    const m = k.match(/^(.+),\s*(lesser|greater|mass|communal)$/);
    if (m) k = `${m[2]} ${m[1]}`;
    return k.replace(/[^a-z0-9]+/g, ' ').trim();
  }
  // Prepared spells and counts from a text statblock, or null when there is none
  function preparedFromText(text) {
    if (!text) return null;
    const lines = String(text).replace(/\r/g, '').split('\n');
    const start = lines.findIndex(l => /Spells (Prepared|Memorized)/i.test(l));
    if (start < 0) return null;
    const out = new Map();
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      const m = l.match(/^(\d)(?:st|nd|rd|th)?\s*(?:\([^)]*\))?\s*[—–-]\s*(.+)$/);
      if (!m) { if (/^(-{5,}|[A-Z][a-z]+ .*(Spells|Spell-Like|Abilities))/.test(l) || !l) break; continue; }
      for (const sp of splitList(m[2])) {
        const cm = sp.match(/\((\d+)(?:,|\))/);
        out.set(spellKey(sp.replace(/\[[^\]]*\]/g, '')), cm ? +cm[1] : 1);
      }
    }
    return out;
  }

  // ---------- class abilities that change numbers, and what Hero Lab has switched on
  function activeEffects(ch, C, attackTexts, warnings) {
    const ac = kid(C, 'armorclass');
    const chaScore = num(at(kid(kids(kid(C, 'attributes'), 'attribute').find(a => lc(at(a, 'name')) === 'charisma'), 'attrvalue'), 'modified'));
    const chaMod = Math.floor((chaScore - 10) / 2);
    const levelOf = n => ch.classes.filter(c => lc(c.name) === n).reduce((a, c) => a + num(c.level), 0);
    const feature = (re, name, text) => {
      let f = ch.classFeatures.find(x => re.test(x.name));
      if (!f) { f = { name, text, bonuses: [] }; ch.classFeatures.push(f); }
      return f;
    };
    const on = [];
    // Divine Grace (paladin 2+) / Unholy Resilience (antipaladin 2+): Charisma bonus on all saves
    if (levelOf('paladin') >= 2 || levelOf('antipaladin') >= 2) {
      const anti = levelOf('antipaladin') >= 2;
      const f = feature(anti ? /^unholy resilience/i : /^divine grace/i, anti ? 'Unholy Resilience' : 'Divine Grace', 'Adds the Charisma bonus (if any) to all saving throws.');
      if (!f.bonuses.length) f.bonuses = [{ label: '', target: 'saves', value: 'max(0, cha)', type: 'Untyped (stacks)', skill: '', weapon: '', text: '', active: true }];
    }
    // Smite Evil / Smite Good: an effect to switch on against the target
    const smite = ch.classFeatures.find(x => /^smite (evil|good)/i.test(x.name));
    if (smite) {
      const cls = /good/i.test(smite.name) ? 'antipaladin' : 'paladin';
      const smiteOn = chaMod > 0 && num(at(ac, 'fromdeflect')) === chaMod;
      ch.effects.unshift({ id: M.uid(), name: smite.name.replace(/\s*\(.*$/, ''), type: 'Untyped (stacks)', active: smiteOn, v: {}, text: '', bonuses: [
        { label: 'Smite: attack', target: 'atk', value: 'max(0, cha)', type: 'Untyped (stacks)', skill: '', weapon: '', text: '', active: true },
        { label: 'Smite: damage', target: 'dmg', value: cls, type: 'Untyped (stacks)', skill: '', weapon: '', text: '', active: true },
        { label: 'Smite: AC', target: 'ac', value: 'max(0, cha)', type: 'Deflection', skill: '', weapon: '', text: '', active: true },
        { label: '', target: 'note', value: '', type: 'Untyped (stacks)', skill: '', weapon: '', text: 'Smite: only against the chosen target; the first hit\'s damage bonus doubles against evil outsiders, dragons and undead', active: true },
      ] });
      if (smiteOn) on.push('Smite');
    }
    // Vindicator's Shield: sacred (or profane) bonus to AC while channeled energy is stored in the shield
    const vs = ch.classFeatures.find(x => /vindicator'?s (sacred |profane )?shield/i.test(x.name));
    if (vs) {
      const amt = firstNum((vs.name.match(/\+(\d+)/) || [])[1]) || 0;
      if (amt) {
        const vsOn = num(at(ac, 'frommisc')) === amt;
        ch.effects.unshift({ id: M.uid(), name: "Vindicator's Shield", type: 'Sacred / Profane', active: vsOn, v: { ac: amt }, text: '' });
        if (vsOn) on.push("Vindicator's Shield");
      }
    }
    // Haste: Hero Lab shows the extra attack as a repeated first attack ("+32/+32/+27...")
    if (attackTexts.some(t => /^([+-]\d+)\/\1\b/.test(String(t).trim()))) {
      const h = ch.effects.find(e => e.preset === 'haste');
      if (h) { h.active = true; on.push('Haste'); }
    }
    if (on.length) warnings.push(`Switched on to match Hero Lab: ${on.join(', ')}. Switch them off on the Play tab when they end.`);
  }

  // ---------- compare with Hero Lab's totals and adjust what doesn't match
  function calibrate(ch, t, warnings) {
    const E = window.PF_ENGINE;
    const sign = x => (x >= 0 ? '+' : '') + x;
    let d = E.compute(ch);
    // Load first (it changes max Dex, armor check penalty and speed): use Hero Lab's when it disagrees with the gear weights here
    if (t.load && d.gear.load !== t.load) {
      ch.movement.encumbrance = t.load;
      warnings.push(`Load: Hero Lab has a ${t.load.toLowerCase()} load (${t.carried} lb); the gear here adds up to ${d.gear.total} lb, often because a handy haversack or bag of holding's contents weigh nothing. Encumbrance is set to ${t.load} by hand; untick Carried for those items and choose Auto to go back.`);
      d = E.compute(ch);
    }

    // Ability scores: anything Hero Lab adds that the sheet doesn't know about goes in the Enhance column
    for (const [k, want] of Object.entries(t.target)) {
      const diff = want - d.abilities[k].score;
      if (diff) { ch.abilities[k].enh = Number(ch.abilities[k].enh || 0) + diff; warnings.push(`${k.toUpperCase()}: added ${sign(diff)} in the Enhance column to match Hero Lab (${want}).`); }
    }
    d = E.compute(ch);

    // HP: the formula that matches Hero Lab, otherwise the difference as favored-class HP
    if (t.hpTarget) {
      const tryF = M.HP_FORMULAS.filter(f => f !== 'Custom Rolled');
      const match = tryF.find(f => { ch.info.hpFormula = f; return E.compute(ch).hp.max === t.hpTarget; });
      if (!match) {
        ch.info.hpFormula = 'Average (1st level max)';
        const diff = t.hpTarget - E.compute(ch).hp.max;
        ch.fcb.hp = diff;
        warnings.push(`HP: added ${sign(diff)} as favored-class/bonus HP to match Hero Lab's ${t.hpTarget}. Check it on the Character tab (it may be Toughness or favored class bonus).`);
      }
    }
    d = E.compute(ch);

    // Saves
    for (const [k, want] of Object.entries(t.saves || {})) {
      if (want === null || want === undefined) continue;
      const diff = want - d.saves[k].total;
      if (diff) { ch.saves[k].misc = Number(ch.saves[k].misc || 0) + diff; warnings.push(`${k[0].toUpperCase() + k.slice(1)} save: misc ${sign(diff)} to match Hero Lab (${sign(want)}).`); }
    }
    // Initiative
    const initWant = t.init;
    d = E.compute(ch);
    if (initWant !== null && initWant !== d.initiative.total) { const diff = initWant - d.initiative.total; ch.initiative.misc = Number(ch.initiative.misc || 0) + diff; warnings.push(`Initiative: misc ${sign(diff)} to match Hero Lab (${sign(initWant)}).`); }
    // AC
    d = E.compute(ch);
    const acWant = t.ac;
    if (acWant && acWant !== d.ac.total) { const diff = acWant - d.ac.total; ch.ac.misc = Number(ch.ac.misc || 0) + diff; warnings.push(`AC: misc ${sign(diff)} to match Hero Lab (${acWant}). Look for a natural armor or other bonus the sheet doesn't have yet.`); }

    // Weapons
    d = E.compute(ch);
    ch.weapons.forEach((w, i) => {
      const want = t.wTargets[i], got = d.weapons[i];
      if (!want || !got || !got.valid) return;
      const notes = [];
      if (want.atk !== null && got.attacks && got.attacks.length) {
        const diff = want.atk - got.attacks[0];
        if (diff) { w.mAtk = Number(w.mAtk || 0) + diff; notes.push(`attack ${sign(diff)}`); }
      }
      if (want.hasDmg && typeof got.damageBonus === 'number') {
        const diff = want.dmg - got.damageBonus;
        if (diff) { w.mDmg = Number(w.mDmg || 0) + diff; notes.push(`damage ${sign(diff)}`); }
      }
      const why = /\((L|S|T|H)\)/.test(w.name) ? ' (an oversized or undersized weapon)' : /composite/i.test(w.name) && Number(w.mDmg) < 0 ? " (the bow's Strength rating limits Str to damage)" : '';
      if (notes.length) warnings.push(`${w.name}: misc ${notes.join(', ')} to match Hero Lab${why}.`);
    });

    // Skills
    d = E.compute(ch);
    const fixed = [];
    for (const [name, s] of Object.entries(ch.skills)) {
      const got = d.skills.find(x => x.name === name);
      if (s._hl !== undefined && got && got.total !== null && (s.ranks > 0 || s._listed)) { const diff = s._hl - got.total; if (diff) { s.misc = Number(s.misc || 0) + diff; fixed.push(`${name} ${sign(diff)}`); } }
      delete s._hl; delete s._listed;
    }
    ch.specialty.forEach((r, i) => {
      const got = d.specialty[i];
      if (r._hl !== undefined && got && got.total !== null) { const diff = r._hl - got.total; if (diff) { r.misc = Number(r.misc || 0) + diff; fixed.push(`${r.base} ${r.detail} ${sign(diff)}`); } }
      delete r._hl;
    });
    if (fixed.length) warnings.push(`Skills adjusted to match Hero Lab (misc): ${fixed.join(', ')}.`);

    // Spellcasting: prestige classes that add caster levels (Holy Vindicator, Mystic Theurge...) raise the class level used
    // for spells per day; find the adjustment that gives Hero Lab's spells per day, then match its caster level.
    if (t.spells && ch.spellcasting.className && Object.keys(t.spells.perDay).length) {
      const sc = ch.spellcasting, levels = Object.entries(t.spells.perDay);
      const score = () => { const dd = E.compute(ch); return levels.reduce((a, [L, want]) => a + Math.abs((dd.spells.levels[L].perDay || 0) - want), 0); };
      let best = { k: 0, s: score() };
      for (let k = 1; k <= 10 && best.s; k++) { sc.classLevelMisc = k; const sv = score(); if (sv < best.s) best = { k, s: sv }; }
      sc.classLevelMisc = best.k;
      if (best.k) warnings.push(`Spells per day: class level +${best.k} for spellcasting to match Hero Lab (from prestige class levels).`);
      if (best.s) warnings.push(`Spells per day still differ from Hero Lab (${levels.map(([L, w]) => `level ${L}: ${w}`).join(', ')}); use the per-day override on the Spells tab.`);
      d = E.compute(ch);
      if (t.spells.cl && d.spells.cl !== t.spells.cl) { const diff = t.spells.cl - d.spells.cl; sc.clMisc = Number(sc.clMisc || 0) + diff; warnings.push(`Caster level: ${sign(diff)} to match Hero Lab (${t.spells.cl}).`); }
    }
    // Final check of the headline numbers
    d = E.compute(ch);
    const cmbWant = t.cmb, cmdWant = t.cmd;
    const off = [];
    if (cmbWant !== null && cmbWant !== d.cmb) off.push(`CMB is ${sign(d.cmb)} here, ${sign(cmbWant)} in Hero Lab`);
    if (cmdWant !== null && cmdWant !== d.cmd) off.push(`CMD is ${d.cmd} here, ${cmdWant} in Hero Lab`);
    if (t.hpTarget && d.hp.max !== t.hpTarget) off.push(`HP is ${d.hp.max} here, ${t.hpTarget} in Hero Lab`);
    if (off.length) warnings.push(off.join('; ') + '.');
    if (t.speed && d.speed.land !== t.speed) warnings.push(`Speed is ${d.speed.land} ft here, ${t.speed} ft in Hero Lab. Check armor and gear weights (the load affects speed).`);
    warnings.unshift(`Matched Hero Lab: AC ${d.ac.total}, HP ${d.hp.max}, Fort ${sign(d.saves.fort.total)}, Ref ${sign(d.saves.ref.total)}, Will ${sign(d.saves.will.total)}, CMB ${sign(d.cmb)}, CMD ${d.cmd}, Initiative ${sign(d.initiative.total)}.`);
  }

  // ---------- older portfolios (Hero Lab 4/5): plain XML with a text statblock plus Hero Lab's internal records
  // Internal skill ids -> sheet skill names (ranks are stored on these as skUser)
  const SKILL_IDS = { skAcrobat: 'Acrobatics', skAppraise: 'Appraise', skBluff: 'Bluff', skClimb: 'Climb', skDiplo: 'Diplomacy', skDisable: 'Disable Device',
    skDisguise: 'Disguise', skEscape: 'Escape Artist', skFly: 'Fly', skHandleAn: 'Handle Animal', skHeal: 'Heal', skIntim: 'Intimidate', skKnowArc: 'Kn. Arcana',
    skKnowDun: 'Kn. Dungeoneering', skKnowEng: 'Kn. Engineering', skKnowGeo: 'Kn. Geography', skKnowHist: 'Kn. History', skKnowHis: 'Kn. History', skKnowLoc: 'Kn. Local',
    skKnowNat: 'Kn. Nature', skKnowNob: 'Kn. Nobility', skKnowPla: 'Kn. Planes', skKnowRel: 'Kn. Religion', skLinguist: 'Linguistics', skPercep: 'Perception',
    skRide: 'Ride', skSenseMot: 'Sense Motive', skSleight: 'Sleight of Hand', skSpellcr: 'Spellcraft', skStealth: 'Stealth', skSurvival: 'Survival', skSwim: 'Swim', skUseMagic: 'Use Magic Device' };
  // Split "A, B (x, y), C" at top-level commas
  function splitList(t) {
    const out = []; let depth = 0, cur = '';
    for (const c of String(t || '')) {
      if (c === '(') depth++; else if (c === ')') depth = Math.max(0, depth - 1);
      if (c === ',' && !depth) { out.push(cur.trim()); cur = ''; } else cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.filter(Boolean);
  }
  // Reads the "Name +4/-1 (1d6+2/18-20/x2)" entries of a Melee or Ranged line
  function attacksFrom(text) {
    const out = [];
    const re = /([A-Za-z][^,()+]*?)\s+([+-]\d+(?:\/[+-]\d+)*)\s+\(([^)]*)\)/g;
    let m;
    while ((m = re.exec(text.replace(/×/g, 'x')))) {
      const name = m[1].replace(/^(and|or)\s+/i, '').replace(/\s+(and|or)$/i, '').trim();
      const parts = m[3].split('/');
      const dmg = parts[0] || '';
      const cr = crit(parts.slice(1).join('/'));
      out.push({ name, atk: firstNum(m[2]), dice: (dmg.match(/\d+d\d+/) || [''])[0], dmg: firstNum(dmg.replace(/^\d+d\d+/, '')) || 0, hasDmg: /\d+d\d+/.test(dmg), crit: cr.crit, mult: cr.mult });
    }
    return out;
  }
  function convertStatblock(text, extra, opts) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, ''));
    const ch = M.normalize(M.blankCharacter());
    const warnings = [];
    ch.source = 'herolab';
    const look = (opts && opts.lookupItem) || (() => null);
    // Sections split by the "--------" rules; the header comes first
    const sect = { head: [] }; let cur = 'head';
    for (let i = 0; i < lines.length; i++) {
      if (/^-{5,}$/.test(lines[i])) { const nm = (lines[i + 1] || '').trim().toLowerCase(); if (nm && /^-{5,}$/.test(lines[i + 2] || '')) { cur = nm; sect[cur] = []; i += 2; continue; } }
      (sect[cur] = sect[cur] || []).push(lines[i]);
    }
    // Lines that wrap ("   spiked gauntlet ...") join onto the previous one
    const joined = key => (sect[key] || []).reduce((acc, l) => { if (/^\s{2,}\S/.test(l) && acc.length) acc[acc.length - 1] += ' ' + l.trim(); else if (l.trim()) acc.push(l.trim()); return acc; }, []);
    const head = joined('head'), def = joined('defense'), off = joined('offense'), stats = joined('statistics');
    const field = (arr, label) => { const l = arr.find(x => x.startsWith(label + ' ')); return l ? l.slice(label.length + 1).trim() : ''; };

    // Identity: "Male Human (Varisian) Paladin (Hospitaler) 1"
    ch.info.name = head[0] || extra.name || 'Hero Lab character';
    ch.info.player = extra.player || '';
    const id = head[1] || '';
    const g = id.match(/^(Male|Female)\s+/i);
    if (g) ch.info.gender = g[1];
    let rest = g ? id.slice(g[0].length) : id;
    const classRe = new RegExp('\\b(' + D.classes.map(c => c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((x, y) => y.length - x.length).join('|') + ')\\b(\\s*\\([^)]*\\))?\\s+(\\d+)', 'gi');
    const found = []; let mm, firstAt = -1;
    while ((mm = classRe.exec(rest))) { if (firstAt < 0) firstAt = mm.index; found.push({ name: findClass(mm[1]).name, level: +mm[3], archetype: (mm[2] || '').replace(/[()]/g, '').trim() }); }
    if (firstAt > 0) ch.info.race = rest.slice(0, firstAt).trim();
    ch.classes = found.map(f => ({ name: f.name, level: f.level, archetypes: archetypesIn(`(${f.archetype})`) }));
    while (ch.classes.length < 3) ch.classes.push({ name: '', level: 0 });
    if (!found.length) warnings.push(`Couldn't read the class from "${id}". Set it on the Character tab.`);
    const arch = found.filter(f => f.archetype).map(f => `${f.name}: ${f.archetype}`);
    const al = (head[2] || '').match(/^(LG|NG|CG|LN|N|CN|LE|NE|CE)\b\s*(\w+)?/);
    if (al) { ch.info.alignment = al[1]; if (M.SIZES.some(z => z.name === al[2])) ch.info.size = al[2]; }

    // Abilities: the statblock's scores are final; they become the base (race modifiers stay 0)
    const ab = field(stats, 'Str') ? 'Str ' + field(stats, 'Str') : stats.find(l => /^Str \d/.test(l)) || '';
    const target = {};
    for (const [k, short] of [['str', 'Str'], ['dex', 'Dex'], ['con', 'Con'], ['int', 'Int'], ['wis', 'Wis'], ['cha', 'Cha']]) {
      const m2 = ab.match(new RegExp(short + '\\s+(\\d+|—|-)'));
      if (m2 && /\d/.test(m2[1])) { ch.abilities[k].base = +m2[1]; target[k] = +m2[1]; }
    }

    // Defense
    const acLine = field(def, 'AC');
    const acM = acLine.match(/^(\d+),\s*touch\s+(\d+),\s*flat-footed\s+(\d+)/);
    const hpM = field(def, 'hp').match(/^(\d+)/);
    const sv = def.find(l => /^Fort /.test(l)) || '';
    const saves = { fort: firstNum((sv.match(/Fort\s+([+-]\d+)/) || [])[1]), ref: firstNum((sv.match(/Ref\s+([+-]\d+)/) || [])[1]), will: firstNum((sv.match(/Will\s+([+-]\d+)/) || [])[1]) };
    const drM = def.join(' ').match(/DR\s+([^;]+)/);
    if (drM) ch.hp.dr = 'DR ' + drM[1].trim();

    // Gear list (Combat Gear ...; Other Gear ...), joining names that contain commas ("Rope, hempen (50 ft.)")
    const gearText = stats.filter(l => /^(Combat Gear|Other Gear|Gear)\b/.test(l)).join('; ');
    const gearItems = [];
    for (const part of gearText.split(';')) {
      const toks = splitList(part.trim().replace(/^(Combat Gear|Other Gear|Gear)\s*/, ''));
      for (let i = 0; i < toks.length; i++) {
        let t = toks[i];
        while (i + 1 < toks.length && (/^[a-z0-9]/.test(toks[i + 1]) || look(`${t}, ${toks[i + 1]}`))) t += ', ' + toks[++i];
        const money = t.match(/^([\d,]+)\s*(pp|gp|sp|cp)$/i);
        if (money) { ch.money[money[2].toLowerCase()] += num(money[1]); continue; }
        const q = t.match(/\s*\((\d+)\)$/);
        gearItems.push({ name: q ? t.slice(0, q.index).trim() : t, qty: q ? +q[1] : 1 });
      }
    }
    // Equipped armor and shield, from the AC breakdown "(+5 armor, +2 shield ...)"
    const acParts = (acLine.match(/\(([^)]*)\)/) || [])[1] || '';
    const used = new Set();
    for (const [kind, table, slot] of [['armor', D.armor, ch.armor], ['shield', D.shields, ch.shield]]) {
      if (!new RegExp('\\+\\d+\\s+' + kind).test(acParts)) continue;
      const it = gearItems.find(x => !used.has(x) && findArmor(table, x.name));
      if (!it) { warnings.push(`The statblock shows ${kind} on, but no ${kind} was found in the gear list. Set it on the Combat tab.`); continue; }
      used.add(it);
      const hit = findArmor(table, it.name);
      Object.assign(slot, { name: it.name, item: hit.name, enh: enhOf(it.name) === 'Mwk' ? 'Mwk' : num(enhOf(it.name)) });
      const L = look(it.name); if (L && L.w) slot.weight = L.w;
    }

    // Weapons from the Melee and Ranged lines
    const catM = D.attackCategories.find(c => c.name.startsWith('Melee Attack')), catR = D.attackCategories.find(c => c.name.startsWith('Ranged Attack'));
    const wTargets = [];
    for (const [label, isRanged] of [['Melee', false], ['Ranged', true]]) {
      for (const a of attacksFrom(field(off, label))) {
        const L = look(a.name);
        const enh = enhOf(a.name);
        const w = Object.assign(M.blankWeapon(), { name: a.name, enh, dice: a.dice, crit: a.crit, mult: a.mult, carried: true });
        if (L) { w.weight = L.w || ''; if (L.ty) w.type = L.ty; if (L.rg) w.range = L.rg + ' ft'; }
        if (isRanged) {
          const thrown = L && L.k && L.k !== 'ranged';
          w.category = catR.name;
          w.formula = opt(catR, thrown || (/composite|sling/i.test(a.name) && a.dmg > num(enh)) ? 'STR to Damage' : 'DEX to hit (').label;
        } else {
          w.category = catM.name;
          w.formula = opt(catM, L && L.k === 'two' ? 'Two-Handed Melee' : 'Standard Melee').label;
        }
        ch.weapons.push(w);
        wTargets.push({ atk: a.atk, dmg: a.dmg, hasDmg: a.hasDmg });
        const inGear = gearItems.find(x => !used.has(x) && stripItem(x.name) === stripItem(a.name));
        if (inGear) used.add(inGear);
      }
    }
    // Everything else is inventory
    for (const it of gearItems) {
      if (used.has(it)) continue;
      const L = look(it.name);
      ch.inventory.push({ name: it.name, qty: it.qty, weight: L && L.w ? L.w : '', value: L && L.cost ? L.cost : '', carried: true, notes: '' });
    }

    // Feats, traits, skills, languages
    const featNames = splitList(field(stats, 'Feats')).map(f => f.replace(/\s+[-+]\/?[-+]?\d+(\/[-+]\d+)?$/, '').replace(/\s+\+\/-\d+$/, ''));
    const traitNames = splitList(field(stats, 'Traits'));
    const suggest = (kind, name) => (window.PF_FEATS ? window.PF_FEATS.suggest(kind, name, Object.keys(D.skillMeta)) || [] : []);
    for (const f of featNames) ch.feats.push({ level: '', name: f, text: '', bonuses: suggest('feat', f) });
    for (const t of traitNames) ch.traits.push({ kind: 'Trait', text: t, bonuses: suggest('trait', t) });
    ch.languages = field(stats, 'Languages');
    for (const sk of splitList(field(stats, 'Skills'))) {
      const m2 = sk.match(/^(.+?)\s+([+-]\d+)/);
      if (!m2) continue;
      const sp = m2[1].match(/^(Craft|Perform|Profession|Artistry|Lore)\s*\((.+)\)$/i);
      if (sp) { const row = { base: SPECIALTY[lc(sp[1])], detail: sp[2], ranks: (extra.special || {})[lc(m2[1])] || 0, misc: 0, _hl: +m2[2] }; const empty = ch.specialty.find(r => r.base === row.base && !r.detail); if (empty) Object.assign(empty, row); else ch.specialty.push(row); continue; }
      const name = skillName(m2[1]);
      if (!D.skillMeta[name]) continue;
      ch.skills[name] = Object.assign(ch.skills[name] || { ranks: 0, misc: 0 }, { _hl: +m2[2], _listed: true });
    }
    for (const [name, r] of Object.entries(extra.ranks || {})) ch.skills[name] = Object.assign(ch.skills[name] || { misc: 0 }, { ranks: r });

    // Special abilities: descriptions go onto the matching feat or trait; the rest are class features
    const known = featNames.concat(traitNames);
    const sla = splitList(field(off, 'Spell-Like Abilities'));
    for (const l of joined('special abilities')) {
      if (/^Hero Lab|^Pathfinder®/.test(l)) continue;
      const k = known.filter(n => l.toLowerCase().startsWith(n.toLowerCase())).sort((x, y) => y.length - x.length)[0];
      let name, desc;
      if (k) { name = k; desc = l.slice(k.length).replace(/^\s*[-+]?[+/\-\d]*\s*/, '').trim(); }
      else {
        const m3 = l.match(/^(.+?\((?:Ex|Su|Sp)\))\s*(.*)$/);
        if (m3) { name = m3[1]; desc = m3[2]; } else { const m4 = l.match(/^((?:[A-Z][\w'’-]*|of|the|and|\+?\d+\S*)(?:\s+(?:[A-Z][\w'’-]*|of|the|and|\(.*?\)|[+-]?\d+\S*))*)\s+(.*)$/); name = m4 ? m4[1] : l; desc = m4 ? m4[2] : ''; }
      }
      const clean = name.replace(/\s*\((Ex|Su|Sp)\)$/, '');
      const feat = ch.feats.find(f => lc(f.name) === lc(clean));
      const trait = ch.traits.find(t => lc(t.text) === lc(clean));
      if (feat) { feat.text = desc; continue; }
      if (trait) { trait.text = `${trait.text}: ${desc}`; continue; }
      if (/\(Sp\)$/.test(name) || sla.some(s2 => lc(s2).startsWith(lc(clean).split(' (')[0]))) continue;
      ch.classFeatures.push({ name: clean, text: desc, bonuses: [] });
    }
    for (const s2 of sla) {
      const grp = /at will/i.test(s2) ? 2 : /constant/i.test(s2) ? 3 : /(\d+)\/day/i.test(s2) ? (/\b1\/day/i.test(s2) ? 0 : 1) : 2;
      ch.spellcasting.sla[grp].items.push({ id: M.uid(), name: s2.replace(/\s*\((at will|constant|\d+\/day)\)/i, ''), uses: '' });
    }
    for (const sq of splitList(field(stats, 'SQ')).concat(splitList(field(off, 'Special Attacks')), splitList(field(def, 'Defensive Abilities').split(';')[0]))) {
      const base = sq.replace(/\s*\(.*\)$/, '');
      if (!ch.classFeatures.some(f => lc(f.name).startsWith(lc(base)))) ch.classFeatures.push({ name: sq, text: '', bonuses: [] });
    }
    // Feats and traits the statblock doesn't describe get their rules text
    const lookText = (opts && opts.lookupText) || (() => '');
    for (const f of ch.feats) if (!f.text) f.text = lookText('feats', f.name) || '';
    for (const t of ch.traits) if (!t.text.includes(':')) { const d2 = lookText('traits', t.text); if (d2) t.text = `${t.text}: ${d2}`; }


    // Spells: "1st—bless, cure light wounds (2)"
    const casting = found.find(f => { const c = findClass(f.name); return c && c.stat; });
    if (casting) { ch.spellcasting.className = casting.name; ch.spellcasting.ability = findClass(casting.name).stat.toLowerCase(); }
    for (const l of off) {
      const m5 = l.match(/^(\d)(?:st|nd|rd|th)?\s*(?:\([^)]*\))?\s*[—–-]\s*(.+)$/);
      if (!m5) continue;
      const L = +m5[1];
      for (const sp of splitList(m5[2])) { const nm = sp.replace(/\s*\(\d+\)$/, '').replace(/\s*\(DC \d+\)/i, '').replace(/[ᴰˢ*]+$/, '').trim(); if (nm && !ch.spellcasting.levels[L].spells.some(x => x.name === nm)) ch.spellcasting.levels[L].spells.push({ id: M.uid(), name: nm.charAt(0).toUpperCase() + nm.slice(1), prepared: '' }); }
    }

    // Speed: Hero Lab's speed already reflects armor and load; start from the race's 30 ft unless the statblock is faster
    const spd = firstNum(field(off, 'Speed'));
    if (spd && spd > 30) ch.info.speeds.base = spd;
    ch.notes = [ch.notes, txtNotes(sect)].filter(Boolean).join('\n\n');

    calibrate(ch, {
      hpTarget: hpM ? +hpM[1] : 0, target, wTargets, saves, init: firstNum(field(head, 'Init')) ?? firstNum((head.find(l => /^Init /.test(l)) || '').slice(5)),
      ac: acM ? +acM[1] : null, cmb: firstNum((stats.join(' ').match(/CMB\s+([+-]\d+)/) || [])[1]), cmd: firstNum((stats.join(' ').match(/CMD\s+(\d+)/) || [])[1]), speed: spd,
    }, warnings);
    if (arch.length) warnings.push(`Archetype set: ${arch.join('; ')}. Click "Add for my level" on the Features & Gear tab to swap in its class features.`);
    warnings.push('This is an older Hero Lab portfolio, so details come from its text statblock. Feat and ability text is what the statblock shows (often shortened).');
    return { character: ch, warnings };
  }
  // Any text after the special abilities that isn't a trademark line (often the character's description)
  function txtNotes(sect) {
    const sa = sect['special abilities'] || [];
    const tail = sa.join('\n').split(/\n\s*\n/).slice(1).join('\n\n').split('\n').filter(l => l.trim() && !/^Hero Lab|^Pathfinder®/.test(l));
    return tail.join('\n').trim();
  }
  function convertLegacy(text, opts) {
    const doc = parseXml(text);
    const heroes = all(doc, 'hero');
    if (!heroes.length) throw new Error('No characters found in this portfolio.');
    return heroes.map(h => {
      const sb = kid(h, 'statblock');
      const ranks = {}, special = {};
      for (const p of all(h, 'pick')) {
        const id = at(p, 'thing'), f = p.kids.find(k => k.tag === 'field' && at(k, 'id') === 'skUser');
        if (f && SKILL_IDS[id]) ranks[SKILL_IDS[id]] = num(at(f, 'user'));
      }
      return convertStatblock(sb ? sb.text : '', { name: at(h, 'heroname'), player: at(h, 'playername'), ranks, special }, opts);
    });
  }

  // ---------- files
  function utf8(bytes) { return new TextDecoder('utf-8').decode(bytes); }
  // A .por portfolio is a zip with one statblocks_xml/N_Name.xml per character.
  function readPortfolio(buf) {
    const X = window.XLSX;
    if (!X || !X.CFB) throw new Error('The file reader (SheetJS) did not load. Check your internet connection and reload.');
    const zip = X.CFB.read(new Uint8Array(buf), { type: 'array' });
    const files = zip.FileIndex.map((f, i) => ({ f, path: zip.FullPaths[i] })).filter(x => /statblocks_xml\/[^/]+\.xml$/i.test(x.path) && x.f.content);
    if (!files.length) throw new Error('No characters found in this portfolio. In Hero Lab, save the portfolio (.por) and try again.');
    const textFor = path => { const want = path.replace('statblocks_xml/', 'statblocks_text/').replace(/\.xml$/i, '.txt'); const i = zip.FullPaths.findIndex(p => p.toLowerCase() === want.toLowerCase()); return i >= 0 && zip.FileIndex[i].content ? utf8(zip.FileIndex[i].content) : ''; };
    return files.map(x => ({ xml: utf8(x.f.content), text: textFor(x.path) }));
  }
  // opts.lookupItem(name) -> { w, cost, k, ty, rg } from the rules data, used for weights and weapon details in older portfolios
  function importHeroLab(buf, fileName, opts) {
    const bytes = new Uint8Array(buf);
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;   // "PK"
    if (/\.por$/i.test(fileName) && isZip) return readPortfolio(buf).map(x => convert(x.xml, x.text));
    // Older portfolios and XML exports are plain XML; read the declared encoding
    const headText = new TextDecoder('latin1').decode(bytes.slice(0, 200));
    const enc = (headText.match(/encoding="([^"]+)"/i) || [])[1] || 'utf-8';
    const text = new TextDecoder(/8859-1|latin|1252/i.test(enc) ? 'windows-1252' : 'utf-8').decode(bytes);
    if (/<document[^>]*signature="Hero Lab Portfolio"/.test(text.slice(0, 500))) return convertLegacy(text, opts);
    return [convert(text)];
  }

  window.PF_HEROLAB = { parseXml, convert, convertStatblock, importHeroLab };
})();
