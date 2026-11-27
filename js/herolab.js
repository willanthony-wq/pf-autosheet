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
  function stripItem(name) { return lc(name).replace(/^\+\d+\s+/, '').replace(/^(masterwork|mwk)\s+/, '').replace(/\s*\(.*\)$/, '').trim(); }
  function findArmor(table, name) {
    const n = stripItem(name), words = n.split(/\s+/);
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
  function convert(xmlText) {
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
      return { name: hit ? hit.name : '', level: num(at(c, 'level')) };
    });
    while (ch.classes.length < 3) ch.classes.push({ name: '', level: 0 });

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
    for (const s of spellEls) {
      const L = Math.min(9, Math.max(0, num(at(s, 'level'))));
      const lv = ch.spellcasting.levels[L];
      const name = at(s, 'name');
      if (!lv.spells.some(x => x.name === name)) lv.spells.push({ id: M.uid(), name, prepared: '', save: at(s, 'save') && !/^none/i.test(at(s, 'save')) ? at(s, 'save').replace(/^DC \d+\s*/i, '') : '', duration: at(s, 'duration') });
    }

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

    calibrate(ch, C, { hpTarget, target, wTargets }, warnings);
    return { character: ch, warnings };
  }

  // ---------- compare with Hero Lab's totals and adjust what doesn't match
  function calibrate(ch, C, t, warnings) {
    const E = window.PF_ENGINE;
    const sign = x => (x >= 0 ? '+' : '') + x;
    let d = E.compute(ch);

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
    const saves = kids(kid(C, 'saves'), 'save');
    for (const s of saves) {
      const k = { fort: 'fort', ref: 'ref', will: 'will' }[lc(at(s, 'abbr'))];
      if (!k) continue;
      const want = firstNum(at(s, 'save')), diff = want - d.saves[k].total;
      if (diff) { ch.saves[k].misc = Number(ch.saves[k].misc || 0) + diff; warnings.push(`${at(s, 'abbr')} save: misc ${sign(diff)} to match Hero Lab (${sign(want)}).`); }
    }
    // Initiative
    const initWant = firstNum(at(kid(C, 'initiative'), 'total'));
    d = E.compute(ch);
    if (initWant !== null && initWant !== d.initiative.total) { const diff = initWant - d.initiative.total; ch.initiative.misc = Number(ch.initiative.misc || 0) + diff; warnings.push(`Initiative: misc ${sign(diff)} to match Hero Lab (${sign(initWant)}).`); }
    // AC
    d = E.compute(ch);
    const acWant = num(at(kid(C, 'armorclass'), 'ac'));
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
      if (notes.length) warnings.push(`${w.name}: misc ${notes.join(', ')} to match Hero Lab${/\((L|S|T|H)\)/.test(w.name) ? ' (an oversized or undersized weapon)' : ''}.`);
    });

    // Skills
    d = E.compute(ch);
    const fixed = [];
    for (const [name, s] of Object.entries(ch.skills)) {
      const got = d.skills.find(x => x.name === name);
      if (s._hl !== undefined && got && got.total !== null && s.ranks > 0) { const diff = s._hl - got.total; if (diff) { s.misc = Number(s.misc || 0) + diff; fixed.push(`${name} ${sign(diff)}`); } }
      delete s._hl;
    }
    ch.specialty.forEach((r, i) => {
      const got = d.specialty[i];
      if (r._hl !== undefined && got && got.total !== null) { const diff = r._hl - got.total; if (diff) { r.misc = Number(r.misc || 0) + diff; fixed.push(`${r.base} ${r.detail} ${sign(diff)}`); } }
      delete r._hl;
    });
    if (fixed.length) warnings.push(`Skills adjusted to match Hero Lab (misc): ${fixed.join(', ')}.`);

    // Final check of the headline numbers
    d = E.compute(ch);
    const cmbWant = firstNum(at(kid(C, 'maneuvers'), 'cmb')), cmdWant = firstNum(at(kid(C, 'maneuvers'), 'cmd'));
    const off = [];
    if (cmbWant !== null && cmbWant !== d.cmb) off.push(`CMB is ${sign(d.cmb)} here, ${sign(cmbWant)} in Hero Lab`);
    if (cmdWant !== null && cmdWant !== d.cmd) off.push(`CMD is ${d.cmd} here, ${cmdWant} in Hero Lab`);
    if (t.hpTarget && d.hp.max !== t.hpTarget) off.push(`HP is ${d.hp.max} here, ${t.hpTarget} in Hero Lab`);
    if (off.length) warnings.push(off.join('; ') + '.');
    warnings.unshift(`Matched Hero Lab: AC ${d.ac.total}, HP ${d.hp.max}, Fort ${sign(d.saves.fort.total)}, Ref ${sign(d.saves.ref.total)}, Will ${sign(d.saves.will.total)}, CMB ${sign(d.cmb)}, CMD ${d.cmd}, Initiative ${sign(d.initiative.total)}.`);
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
    return files.map(x => utf8(x.f.content));
  }
  function importHeroLab(buf, fileName) {
    const xmls = /\.por$/i.test(fileName) ? readPortfolio(buf) : [utf8(new Uint8Array(buf))];
    return xmls.map(convert);
  }

  window.PF_HEROLAB = { parseXml, convert, importHeroLab };
})();
