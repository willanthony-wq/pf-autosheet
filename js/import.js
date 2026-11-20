// Import a character from a Pathfinder Autosheet v6.x workbook (.xlsx download of the Google Sheet).
// Players often insert rows, so sections are located by their labels rather than fixed row numbers.
//
// importAutosheet(book) where book = { v(sheet, addr) -> cached value, f(sheet, addr) -> formula text or '', maxRow(sheet) }.
(function () {
  'use strict';
  const M = window.PF_MODEL;
  const D = window.PF_DATA;

  function s(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    const x = typeof v === 'number' ? v : parseFloat(String(v).replace(/^\+/, ''));
    return Number.isFinite(x) ? x : 0;
  }
  function numOrBlank(v) { const t = s(v).replace(/^\/\s*/, ''); return t === '' || !Number.isFinite(parseFloat(t)) ? '' : num(t); }
  function bool(v) { return v === true || /^true$/i.test(s(v)); }
  function intStr(v) { const t = s(v); return /^-?\d+(\.0+)?$/.test(t) ? String(parseInt(t, 10)) : t; }
  function colNum(letters) { let c = 0; for (const ch of letters) c = c * 26 + ch.charCodeAt(0) - 64; return c; }
  function colLetter(c) { let out = ''; while (c > 0) { const r = (c - 1) % 26; out = String.fromCharCode(65 + r) + out; c = Math.floor((c - 1) / 26); } return out; }

  const EFFECT_SHEET_COLS = {
    N: 'ac', O: 'nat', P: 'fort', Q: 'ref', R: 'will', S: 'str', T: 'dex', U: 'con', V: 'int', W: 'wis', X: 'cha',
    Y: 'mAtk', Z: 'mDmg', AA: 'ohDmg', AB: 'thDmg', AC: 'm1st', AD: 'rAtk', AE: 'rDmg', AF: 'r1st', AG: 'cl',
    AH: 'twf', AI: 'xMelee', AJ: 'xRanged', AK: 'size', AL: 'speed', AM: 'fly', AN: 'swim', AO: 'burrow', AP: 'climb', AQ: 'skills',
  };

  // ---------- Formula translation (same rules as extract.py) ----------
  function translateFormula(f) {
    let t = s(f);
    if (!t) return '0';
    const dummy = t.match(/DUMMYFUNCTION\("([\s\S]*)"\),/);
    if (dummy) t = dummy[1].replace(/""/g, '"');
    t = t.replace(/^=/, '');
    t = t.replace(/if\(or\(arrayformula\(regexmatch\('Main Sheet'!\$AE\$2:\$AE\$4,"Monk \\\(Unchained\\\)"\)\)\),/i, 'IF(v.unchainedMonk,');
    if (/^\s*1\/0\s*$/.test(t)) return null;
    const reps = [
      [/iferror\(vlookup\("Monk",'Main Sheet'!\$?AE\$?2:\$?AQ\$?4,13,false\),""\)/gi, 'v.monkLevel'],
      [/iferror\(vlookup\("Monk",'Main Sheet'!\$?AE\$?2:\$?AQ\$?4,9,false\),""\)/gi, 'v.monkBab'],
      [/VLOOKUP\(Size,SizeTable,3,false\)/gi, 'v.sizeAtk'], [/VLOOKUP\(Size,SizeTable,4,false\)/gi, 'v.sizeCmb'],
      [/'Main Sheet'!\$D\$68/g, 'v.cl'], [/'Main Sheet'!\$G\$52/g, 'v.castMod'],
      [/'Main Sheet'!\$AQ\$2/g, 'v.class1Level'], [/'Main Sheet'!\$AM\$2/g, 'v.class1Bab'],
      [/'Main Sheet'!\$AH\$96/g, 'v.twf'], [/'Main Sheet'!\$BG\$16/g, 'v.bab'],
      [/\bBaseAttack\b/g, 'v.bab'], [/\bStrength\b/g, 'v.str'], [/\bDexterity\b/g, 'v.dex'], [/\bConstitution\b/g, 'v.con'],
      [/\bIntelligence\b/g, 'v.int'], [/\bWisdom\b/g, 'v.wis'], [/\bCharisma\b/g, 'v.cha'], [/\bLevel\b/g, 'v.level'],
      [/\b(tMeleeAttack|tMeleeDamage|tOHDamage|t2HDamage|tRangedAttack|tRangedDamage)\b/g, 'v.$1'],
      [/\brounddown\(/gi, 'RD('], [/\bint\(/gi, 'FL('], [/\bmax\(/gi, 'MAX('], [/\bif\(/gi, 'IF('],
    ];
    for (const [a, b] of reps) t = t.replace(a, b);
    if (/'|\$|vlookup|!/i.test(t)) return undefined; // couldn't translate
    return t;
  }

  function importAutosheet(book) {
    const ch = M.blankCharacter();
    const warnings = [];
    const MS = 'Main Sheet';
    const get = addr => book.v(MS, addr);
    const maxRow = book.maxRow(MS) || 200;

    function findRow(colL, re, from, to) {
      for (let r = from || 1; r <= (to || maxRow); r++) if (re.test(s(get(colL + r)))) return r;
      return null;
    }
    const abil = findRow('B', /^ABILITIES$/, 1, 40) || 8;
    const dA = abil - 8;
    const at = (c, r) => get(c + (r + dA));      // rows 5..46 (abilities, skills, offenses, armor)
    const spellRow = findRow('B', /^SPELLCASTING$/, abil, maxRow) || (48 + dA);
    const dS = spellRow - 48;
    const atS = (c, r) => get(c + (r + dS));
    const traitsRow = findRow('B', /^TRAITS AND DRAWBACK/, spellRow, maxRow) || (70 + dS);
    const racialRow = findRow('B', /^RACIAL FEATURES/, traitsRow, maxRow) || (traitsRow + 6);
    const effectRow = findRow('B', /^EFFECT TABLE/, traitsRow, maxRow) || (traitsRow + 22);
    const semiRow = findRow('B', /^Semi-Permanent/, effectRow, maxRow) || (effectRow + 5);
    const toggleRow = findRow('B', /^Combat Quick Toggle/, semiRow, maxRow) || (semiRow + 25);
    const condRow = findRow('B', /^Conditions \(/, toggleRow, maxRow) || (toggleRow + 11);

    // ---- Identity
    ch.info.name = s(get('B2'));
    ch.info.alignment = s(get('J2'));
    ch.info.race = s(get('N2'));
    ch.info.deity = s(get('R2'));
    if (M.XP.tracks.includes(s(get('V2')))) ch.info.xpTrack = s(get('V2'));
    ch.info.xp = num(at('V', 5));
    if (M.SIZES.some(z => z.name === s(at('B', 5)))) ch.info.size = s(at('B', 5));
    if (M.AGE.categories.includes(s(at('F', 5)))) ch.info.age = s(at('F', 5));
    ch.info.ageYears = intStr(at('H', 5));
    const hpf = s(at('V', 8)).replace(/\s+/g, ' ').toLowerCase();
    const hpMap = { 'average': 'Average', 'average (1st level max)': 'Average (1st level max)', 'average round up': 'Average round up',
      'average round up (1st level max)': 'Average round up (1st level max)', 'maximum': 'Maximum', 'custom rolled': 'Custom Rolled' };
    if (hpMap[hpf]) ch.info.hpFormula = hpMap[hpf];

    // ---- Classes (rows 2 .. the "Totals" row)
    const totalsRow = findRow('AD', /^Totals$/, 2, 20) || 6;
    ch.classes = [];
    for (let r = 2; r < totalsRow; r++) {
      const name = s(get('AE' + r)), level = num(get('AQ' + r));
      if (name && level) ch.classes.push({ name, level });
    }
    if (ch.classes.length > 3) warnings.push('More than three classes found; extra classes were added below the usual three.');
    while (ch.classes.length < 3) ch.classes.push({ name: '', level: 0 });
    ch.fcb.hp = num(get('Z3'));
    ch.fcb.skills = num(get('Z4'));
    ch.fcb.other = s(get('Z5'));
    importCustomClasses(book, ch, warnings);

    // ---- Abilities
    M.ABILITIES.forEach((a, i) => {
      const r = 9 + i;
      ch.abilities[a] = { base: num(at('I', r)), enh: num(at('J', r)), inh: num(at('K', r)), pen: num(at('M', r)) };
    });

    // ---- HP & defenses
    ch.hp.damage = num(at('S', 13));
    ch.hp.temp = num(at('Z', 13));
    ch.hp.nonlethal = num(at('Z', 14));
    const drsr = s(at('O', 10));
    if (drsr && !/^DR -\s*SR -$/.test(drsr)) ch.hp.dr = drsr;
    const res = s(at('O', 13));
    if (res && !/^Fire 0\s+Cold 0\s+Acid 0\s+Elect 0$/.test(res.replace(/\s+/g, ' '))) ch.hp.resist = res;
    ch.saves.fort.misc = num(at('K', 17));
    ch.saves.ref.misc = num(at('K', 18));
    ch.saves.will.misc = num(at('K', 19));
    ch.saves.notes = textBelow(at('H', 22), 'Saving Throw Notes');
    ch.ac.misc = num(at('AA', 17));
    ch.ac.notes = textBelow(at('V', 22), 'Armor Class Notes');

    // ---- Welcome Page settings
    const wel = a => book.v('Welcome Page', a);
    if (M.SKILL_SYSTEMS.includes(s(wel('P6')))) ch.settings.skillSystem = s(wel('P6'));
    ch.settings.woundThresholds = s(wel('P7')) === 'ACTIVE';
    ch.settings.minSkillRanks = s(wel('P8')) === 'ACTIVE';

    // ---- Skills (rows 9-45)
    ch.specialty = [];
    for (let r = 9; r <= 45; r++) {
      const name = s(at('AE', r));
      if (!name || /SKILLS/.test(name)) continue;
      const ranks = num(at('AL', r)), misc = num(at('AO', r));
      const marked = /^x$/i.test(s(at('AD', r)));
      const granted = ch.classes.some(c => c.name && classSkillsFor(ch, c.name).includes(name));
      const classSkill = marked && !granted;
      if (name.endsWith(':')) {
        const detail = s(at('AG', r));
        ch.specialty.push({ base: name, detail, ranks, misc, classSkill });
      } else if (ranks || misc || classSkill) {
        ch.skills[name] = { ranks, misc, classSkill };
      }
    }
    if (!ch.specialty.length) ch.specialty = M.blankCharacter().specialty;
    ch.languages = s(at('AG', 46));

    // ---- Weapons (rows 26-31); only rows the player actually filled in
    ch.customAttackOptions = [];
    ch.weapons = [];
    for (let i = 0; i < 6; i++) {
      const r = 26 + i;
      const enhRaw = s(at('D', r));
      const w = {
        name: s(at('E', r)), mAtk: num(at('B', r)), mDmg: num(at('C', r)),
        enh: /^(Masterwork|Mwk)$/i.test(enhRaw) ? 'Masterwork' : (enhRaw ? intStr(enhRaw) : '0'),
        category: s(at('M', r)), formula: s(at('N', r)), dice: s(at('U', r)),
        crit: critText(at('Y', r)), mult: multText(at('Z', r)), range: intStr(at('AA', r)), type: s(at('AB', r)),
      };
      if (!w.name && !w.formula) w.dice = '';
      // A damage cell typed over its formula becomes a damage override (e.g. "1d10 + 5").
      const dmgCell = 'V' + (r + dA);
      if (!s(book.f(MS, dmgCell)) && s(get(dmgCell))) w.dmgOverride = s(get(dmgCell));
      if (w.category && w.formula) ensureAttackOption(book, ch, w, warnings);
      if (!M.isBlankWeapon(w)) ch.weapons.push(w);
    }
    ch.attackNotes = textBelow(at('J', 33), 'Attack Notes');

    // ---- Quick toggles & conditions (state cells in U/Y 33-39)
    const toggleCells = [['U', 33, 'powerAttack'], ['U', 34, 'combatExpertise'], ['U', 35, 'deadlyAim'], ['U', 36, 'heroism'], ['U', 37, 'haste'],
      ['Y', 33, 'rapidShot'], ['Y', 34, 'studiedTarget'], ['Y', 35, 'custom8'], ['Y', 36, 'custom9'], ['Y', 37, 'custom10']];
    for (const [c, r, id] of toggleCells) {
      const t = ch.toggles.find(x => x.id === id);
      if (t) t.active = bool(at(c, r));
    }
    // Toggle definition rows (values the player may have edited)
    const toggleIds = ['powerAttack', 'combatExpertise', 'deadlyAim', 'heroism', 'haste', 'rapidShot', 'studiedTarget', 'custom8', 'custom9', 'custom10'];
    toggleIds.forEach((id, i) => {
      const r = toggleRow + 1 + i;
      const t = ch.toggles.find(x => x.id === id);
      const nm = s(get('B' + r));
      if (id.startsWith('custom') && nm && !/^\(Custom Effect/.test(nm)) t.name = nm;
      const ty = s(get('G' + r)); if (ty && M.BONUS_TYPES.includes(ty)) t.type = ty;
      if (t.auto) return; // Power Attack etc. are recomputed from BAB
      const tmp = { v: {}, text: '' };
      readEffectValues(get, r, tmp);
      ['speed', 'fly', 'swim', 'burrow', 'climb'].forEach(k => delete tmp.v[k]);
      if (Object.keys(tmp.v).length || id.startsWith('custom')) { t.v = tmp.v; t.text = tmp.text; }
    });
    for (const [flagC, nameC, r] of [['U', 'V', 38], ['U', 'V', 39], ['Y', 'Z', 38]]) {
      const nm = s(at(nameC, r));
      if (bool(at(flagC, r)) && nm) ch.conditions.push(nm);
    }
    ch.negativeLevels = num(at('Y', 39));

    // ---- Movement & initiative
    const ign = s(at('M', 36));
    ch.movement.ignoreArmor = ign === '_' ? '' : ign;
    const fl = s(at('M', 37));
    if (fl) ch.movement.flight = fl.charAt(0).toUpperCase() + fl.slice(1).toLowerCase();
    ch.movement.runMult = numOrBlank(at('M', 38));
    ch.movement.chargeBonus = num(at('M', 39));
    ch.initiative.misc = num(at('R', 38));

    // ---- Armor & shield (rows 42/43)
    [['armor', 42], ['shield', 43]].forEach(([k, r]) => {
      const enhRaw = s(at('D', r));
      ch[k] = {
        name: s(at('E', r)) || s(at('J', r)), item: s(at('M', r)), material: s(at('N', r)),
        enh: /^(Mwk|Masterwork)$/i.test(enhRaw) ? 'Mwk' : num(enhRaw), mSkill: num(at('B', r)), mDex: num(at('C', r)),
      };
    });
    if (ch.shield.item === '(no shield)') ch.shield.item = '';
    ch.armorNotes = textBelow(at('H', 45), 'Armor Notes');

    // ---- Magic item features (T42:AB46)
    for (let i = 0; i < 5; i++) {
      const r = 42 + i;
      // The sheet's combined "Deflect/Enhance/Resist" type is split by target in PF_MODEL.normalize().
      ch.magicItems[i] = { name: s(at('T', r)), target: s(at('X', r)) || 'Saves', type: s(at('Z', r)) || 'Deflect/Enhance/Resist', value: numOrBlank(at('AB', r)) };
    }

    // ---- Effects table (between "Semi-Permanent" and "Combat Quick Toggle")
    const itemNames = new Set(ch.magicItems.map(m => m.name).filter(Boolean));
    for (let r = semiRow + 1; r < toggleRow; r++) {
      const name = s(get('B' + r));
      if (/^Base Move Speeds?$/i.test(name)) {
        const sp = ch.info.speeds;
        sp.base = num(get('AL' + r)) || 30;
        sp.fly = numOrBlank(get('AM' + r)); sp.swim = numOrBlank(get('AN' + r));
        sp.burrow = numOrBlank(get('AO' + r)); sp.climb = numOrBlank(get('AP' + r));
        continue;
      }
      if (!name || /Expand\s+for more/i.test(name)) continue;
      // Rows that mirror the Magic Item features block are formulas; skip them.
      if (itemNames.has(name) && /^=/.test(s(book.f(MS, 'B' + r)))) continue;
      const e = M.blankEffect(name, s(get('G' + r)) || 'Untyped (stacks)');
      e.active = s(get('K' + r)) !== 'INACTIVE';
      readEffectValues(get, r, e);
      ch.effects.push(e);
    }

    // ---- Spellcasting
    const sc = ch.spellcasting;
    sc.className = s(atS('B', 50));
    const ab = s(atS('D', 52)).toLowerCase().slice(0, 3);
    if (M.ABILITIES.includes(ab)) sc.ability = ab;
    sc.classLevelMisc = num(atS('G', 66));
    sc.clMisc = num(atS('G', 68));
    // Spells per day typed over the formula (no formula in the cell) become overrides.
    for (let L = 0; L <= 9; L++) {
      const addr = 'D' + (55 + L + dS);
      const val = get(addr);
      if (!s(book.f(MS, addr)) && s(val) !== '' && (typeof val === 'number' || /^(\d+|∞)$/.test(s(val)))) sc.levels[L].perDayOverride = s(val) === '∞' ? '' : num(val);
    }
    const spellCols = [['I', 'J'], ['P', 'Q'], ['W', 'X'], ['AD', 'AE'], ['AK', 'AL']];
    [[50, 59, 0], [61, 69, 5]].forEach(([r0, r1, base]) => {
      spellCols.forEach(([mark, nameCol], i) => {
        for (let r = r0; r <= r1; r++) {
          const nm = s(atS(nameCol, r));
          if (!nm || /LEVEL|CANTRIPS/.test(nm)) continue;
          sc.levels[base + i].spells.push({ name: nm, prepared: s(atS(mark, r)) });
        }
      });
    });
    [50, 55, 60, 65].forEach((h, i) => {
      for (let r = h + 1; r < h + 5; r++) {
        const nm = s(atS('AS', r));
        if (!nm || /rearrange these|whatever order|fits your character/.test(nm)) continue;
        sc.sla[i].items.push({ name: nm, uses: intStr(atS('AR', r)) });
      }
    });
    const notes = [];
    for (let r = 50; r <= 69; r++) {
      const t = s(atS('BG', r));
      if (t && !/This snippet|DC \+|SUGGESTED|Spells are|Mythic Spells/.test(t)) notes.push(t);
    }
    sc.notes = notes.join('\n');

    // ---- Traits / racial features / class features / feats / notes
    for (let r = traitsRow + 1; r < racialRow; r++) {
      const t = s(get('C' + r)); if (t) ch.traits.push({ kind: s(get('B' + r)) || 'Trait', text: t });
    }
    for (let r = racialRow + 1; r < effectRow; r++) {
      const t = s(get('C' + r)); if (t) ch.racialFeatures.push({ name: s(get('B' + r)), text: t });
    }
    let heroRow = null, chanRow = null;
    const story = [];
    for (let r = traitsRow + 1; r < effectRow; r++) {
      const nm = s(get('O' + r)), t = s(get('R' + r));
      if (nm || t) ch.classFeatures.push({ name: nm, text: t });
      const fn = s(get('AA' + r)), ft = s(get('AD' + r));
      if (fn || ft) ch.feats.push({ level: intStr(get('Z' + r)), name: fn, text: ft });
      const am = s(get('AM' + r));
      if (/HERO POINTS/i.test(am)) heroRow = r;
      if (/CHANNEL ENERGY/i.test(am)) chanRow = r;
      for (const c of ['AL', 'AM', 'AN', 'AO']) {
        const txt = s(get(c + r));
        if (txt && txt.length > 3 && !/HERO POINTS|CHANNEL ENERGY|clear this region|Copy\/Pasting|STORY & MISC/.test(txt)) story.push(txt);
      }
    }
    ch.notes = story.join('\n');
    if (heroRow) ch.heroPoints = { current: num(get('AM' + (heroRow + 1))), max: num(get('AP' + (heroRow + 1))) || 3 };
    // ---- Resources (AS uses / AT max / AU name; optional second column AX/AY/AZ) and magic item slots
    for (let r = 33; r <= 46; r++) {
      const nm = s(at('AU', r));
      if (nm) ch.resources.push({ name: nm, uses: numOrBlank(at('AS', r)), max: numOrBlank(at('AT', r)) });
      const nm2 = s(at('AZ', r));
      if (nm2) ch.resources.push({ name: nm2, uses: numOrBlank(at('AX', r)), max: numOrBlank(at('AY', r)) });
    }
    if (chanRow) ch.resources.push({ name: 'Channel Energy', uses: numOrBlank(get('AP' + chanRow)), max: numOrBlank(get('AS' + chanRow)) });
    ch.slots = [];
    for (let r = 33; r <= 45; r++) {
      const slot = s(at('BE', r));
      if (slot) ch.slots.push({ slot, item: s(at('BG', r)) });
    }
    if (!ch.slots.length) ch.slots = M.blankCharacter().slots;

    // ---- Background answers: text below each question in column BC
    const qPatterns = [/How were you raised/i, /Where\/From whom/i, /life goals/i, /most important personal/i, /character flaw/i, /secretly fear/i];
    const qRows = qPatterns.map(re => findRow('BC', re, effectRow - 5, maxRow));
    ch.background = M.BACKGROUND_QUESTIONS.map((q, i) => {
      const r0 = qRows[i];
      if (!r0) return { q, a: '' };
      const next = qRows.slice(i + 1).find(Boolean) || r0 + 3;
      const parts = [];
      for (let r = r0 + 1; r < next && r < r0 + 6; r++) { const t = s(get('BC' + r)) || s(get('BD' + r)); if (t) parts.push(t); }
      return { q, a: parts.join('\n') };
    });

    return { character: M.normalize(ch), warnings };
  }

  // ---------- Custom classes: copy any class the character uses that isn't in the built-in tables ----------
  function classSkillsFor(ch, name) {
    const cc = (ch.customClasses || []).find(c => c.name === name);
    return cc ? cc.classSkills : (D.classSkills[name] || []);
  }
  function importCustomClasses(book, ch, warnings) {
    ch.customClasses = [];
    const CC = 'Class Charts', CS = 'Class Skills';
    const ccMax = book.maxRow(CC), csMax = book.maxRow(CS);
    const names = new Set(ch.classes.map(c => c.name).filter(Boolean));
    for (const name of names) {
      let row = null;
      for (let r = 1; r <= ccMax && !row; r++) if (s(book.v(CC, 'B' + r)) === name && Number.isFinite(parseFloat(book.v(CC, 'C' + r)))) row = r;
      if (!row) { warnings.push(`Class "${name}" wasn't found in the workbook's Class Charts; pick a class from the list.`); continue; }
      const ref = v => { const m = s(v).match(/\$?([A-Z]+)\$?(\d+)/); return m ? m[1] + m[2] : null; };
      const stat = s(book.v(CC, 'I' + row));
      const perDayRef = ref(book.f(CC, 'J' + row) || book.v(CC, 'J' + row));
      const knownRaw = s(book.v(CC, 'K' + row));
      const knownRef = ref(book.f(CC, 'K' + row) || knownRaw);
      const cls = {
        cat: s(book.v(CC, 'A' + row)) || 'Custom', name, hd: num(book.v(CC, 'C' + row)), bab: num(book.v(CC, 'D' + row)),
        fort: s(book.v(CC, 'E' + row)), ref: s(book.v(CC, 'F' + row)), will: s(book.v(CC, 'G' + row)),
        skills: num(book.v(CC, 'H' + row)), stat: /^[A-Z]{3}$/.test(stat) ? stat : null,
      };
      const table = r => {
        if (!r) return null;
        const m = r.match(/([A-Z]+)(\d+)/), c0 = colNum(m[1]), r0 = parseInt(m[2], 10);
        const rows = [];
        for (let lv = 1; lv <= 20; lv++) {
          const row2 = [];
          for (let sl = 0; sl < 10; sl++) {
            const v = book.v(CC, colLetter(c0 + 1 + sl) + (r0 + lv));
            row2.push(typeof v === 'number' ? v : (s(v) === '∞' ? 'inf' : (Number.isFinite(parseFloat(v)) && /^\d/.test(s(v)) ? parseFloat(v) : null)));
          }
          rows.push(row2);
        }
        return rows;
      };
      cls.perDayTable = table(perDayRef);
      cls.knownTable = /^(Spellbook|Divine)$/.test(knownRaw) ? null : table(knownRef);
      cls.known = /^(Spellbook|Divine)$/.test(knownRaw) ? knownRaw : null;
      // Class skills
      let srow = null;
      for (let r = 1; r <= csMax && !srow; r++) if (s(book.v(CS, 'A' + r)) === name) srow = r;
      const skills = new Set();
      if (srow) {
        for (let c = 2; c <= 64; c++) {
          const head = s(book.v(CS, colLetter(c) + '1'));
          if (head && /^x$/i.test(s(book.v(CS, colLetter(c) + srow)))) skills.add(head);
        }
        if (skills.has('Craft:') || skills.has('Perform:')) skills.add('Artistry:');
      }
      cls.classSkills = srow ? [...skills].sort() : (D.classSkills[name] || []);

      const builtin = D.classes.find(c => c.name === name);
      const same = builtin && ['hd', 'bab', 'fort', 'ref', 'will', 'skills'].every(k => builtin[k] === cls[k]) &&
        JSON.stringify((D.classSkills[name] || []).slice().sort()) === JSON.stringify(cls.classSkills) &&
        (!builtin.perDay || JSON.stringify(D.spellTables[builtin.perDay]) === JSON.stringify(cls.perDayTable));
      if (!same) ch.customClasses.push(cls);
    }
  }

  // ---------- Custom attack formulas ----------
  function ensureAttackOption(book, ch, w, warnings) {
    const cat = D.attackCategories.find(c => c.name === w.category);
    if (cat && cat.options.some(o => o.label === w.formula)) return;
    const FR = 'Formula References';
    for (let c = 3; c <= 40; c += 3) {
      if (s(book.v(FR, colLetter(c) + '44')) !== w.category) continue;
      for (let r = 45; r <= 70; r++) {
        if (s(book.v(FR, colLetter(c) + r)) !== w.formula) continue;
        const atk = translateFormula(book.f(FR, colLetter(c + 1) + r));
        const dmg = translateFormula(book.f(FR, colLetter(c + 2) + r));
        if (atk === undefined || dmg === undefined) break;
        if (!ch.customAttackOptions.some(o => o.category === w.category && o.label === w.formula)) {
          ch.customAttackOptions.push({ category: w.category, label: w.formula, atk, dmg });
        }
        return;
      }
    }
    warnings.push(`Weapon "${w.name || w.formula}": attack formula "${w.formula}" couldn't be imported; choose a formula on the Combat tab.`);
  }

  function readEffectValues(get, r, target) {
    target.v = target.v || {};
    for (const [c, key] of Object.entries(EFFECT_SHEET_COLS)) {
      const raw = get(c + r);
      if (raw === null || raw === undefined || raw === '') continue;
      const t = s(raw);
      if (/^(speed|fly|swim|burrow|climb)$/.test(key) && /^x/i.test(t)) { target.v[key] = t; continue; }
      if (Number.isFinite(parseFloat(t)) && /^[-+]?\d/.test(t)) target.v[key] = num(t);
    }
    const txt = s(get('AR' + r));
    if (txt && txt !== '-') target.text = txt;
  }

  function textBelow(v, label) { const t = s(v); return t && t !== label ? t : ''; }
  function critText(v) {
    const t = s(v);
    if (!t) return '20';
    if (/^\d+(\.0+)?$/.test(t)) { const x = parseInt(t, 10); return x >= 20 ? '20' : x + '-20'; }
    return t;
  }
  function multText(v) {
    const t = s(v);
    if (!t) return 'x2';
    if (/^\d+(\.0+)?$/.test(t)) return 'x' + parseInt(t, 10);
    return /^[x×]/i.test(t) ? t.replace('×', 'x') : 'x' + t;
  }

  // ---------- Browser: read an .xlsx ArrayBuffer with SheetJS ----------
  function importXlsxBuffer(buf) {
    if (!window.XLSX) throw new Error('The spreadsheet reader (SheetJS) did not load. Check your internet connection and reload.');
    const wb = window.XLSX.read(buf, { type: 'array', cellFormula: true });
    if (!wb.Sheets['Main Sheet']) throw new Error('This workbook has no "Main Sheet" tab. Is it a Pathfinder Autosheet?');
    const book = {
      v: (sh, a) => { const ws = wb.Sheets[sh]; const c = ws && ws[a]; return c && c.v !== undefined ? c.v : ''; },
      f: (sh, a) => { const ws = wb.Sheets[sh]; const c = ws && ws[a]; return c && c.f ? '=' + c.f : ''; },
      maxRow: sh => { const ws = wb.Sheets[sh]; if (!ws || !ws['!ref']) return 0; return window.XLSX.utils.decode_range(ws['!ref']).e.r + 1; },
    };
    return importAutosheet(book);
  }

  window.PF_IMPORT = { importAutosheet, importXlsxBuffer, translateFormula };
})();
