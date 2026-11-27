// Companions: animal companions, familiars and other creatures (cohorts, eidolons, mounts).
// compute(companion, masterDerived) -> derived numbers. Pure; never mutates the companion.
(function () {
  'use strict';
  const M = window.PF_MODEL;
  const ABIL = M.ABILITIES;

  // Core Rulebook animal companion progression, by effective druid level 1-20.
  // [HD, natural armor bonus, Str/Dex bonus, bonus tricks, special]
  const AC_TABLE = [
    [2, 0, 0, 1, 'Link, share spells'], [3, 0, 0, 1, ''], [3, 2, 1, 2, 'Evasion'], [4, 2, 1, 2, 'Ability score increase'],
    [5, 2, 1, 2, ''], [6, 4, 2, 3, 'Devotion'], [6, 4, 2, 3, ''], [7, 4, 2, 3, ''], [8, 6, 3, 4, 'Ability score increase, Multiattack'],
    [9, 6, 3, 4, ''], [9, 6, 3, 4, ''], [10, 8, 4, 5, ''], [11, 8, 4, 5, ''], [12, 8, 4, 5, 'Ability score increase'],
    [12, 10, 5, 6, 'Improved evasion'], [13, 10, 5, 6, ''], [14, 10, 5, 6, ''], [15, 12, 6, 7, ''], [15, 12, 6, 7, ''],
    [16, 12, 6, 7, 'Ability score increase'],
  ];
  const AC_SKILLS = ['Acrobatics', 'Climb', 'Escape Artist', 'Fly', 'Intimidate', 'Perception', 'Stealth', 'Survival', 'Swim'];
  // Familiar abilities by master level
  const FAMILIAR_SPECIAL = [[1, 'Alertness, improved evasion, share spells, empathic link'], [3, 'Deliver touch spells'],
    [5, 'Speak with master'], [7, 'Speak with animals of its kind'], [11, 'Spell resistance (master level + 5)'], [13, 'Scry on familiar']];

  // APG summoner eidolon base statistics by summoner level 1-20.
  // HD, armor (natural) bonus, Str/Dex bonus, evolution pool, max attacks
  const EIDOLON = {
    hd: [1, 2, 3, 3, 4, 5, 6, 6, 7, 8, 9, 10, 11, 11, 12, 13, 14, 15, 16, 16],
    armor: [0, 2, 2, 2, 4, 4, 6, 6, 6, 8, 8, 10, 10, 10, 12, 12, 14, 14, 16, 16],
    phys: [0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 6, 6, 7, 7, 8, 8],
    pool: [3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 25, 26],
    maxAttacks: [3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7],
    special: { 1: 'Darkvision, link, share spells', 2: 'Evasion', 4: 'Ability score increase', 6: 'Devotion', 9: 'Multiattack',
      10: 'Ability score increase', 14: 'Improved evasion', 15: 'Ability score increase' },
  };
  // Eidolon base forms set which two saves are good.
  const BASE_FORMS = { Biped: { fort: true, ref: false, will: true }, Quadruped: { fort: true, ref: true, will: false }, Serpentine: { fort: false, ref: true, will: true } };

  const KINDS = ['Animal Companion', 'Eidolon', 'Familiar', 'Other'];

  // Common buffs for companions (bonuses are editable after adding).
  const B = (target, value, type, extra) => Object.assign({ label: '', target, value, type, skill: '', weapon: '', text: '', active: true }, extra || {});
  const BUFF_PRESETS = {
    'Bless': [B('atk', 1, 'Morale'), B('note', '', 'Morale', { text: '+1 morale on saves against fear' })],
    'Haste': [B('ac', 1, 'Dodge (stacks)'), B('atk', 1, 'Untyped (stacks)'), B('ref', 1, 'Dodge (stacks)'), B('note', '', 'Untyped (stacks)', { text: 'One extra attack at full bonus on a full attack; +30 ft. speed' })],
    'Heroism': [B('atk', 2, 'Morale'), B('saves', 2, 'Morale'), B('skills', 2, 'Morale')],
    'Mage Armor': [B('ac', 4, 'Armor')],
    'Barkskin': [B('nat', 'max(2, min(5, 2 + floor((cl - 3) / 3)))', 'Enhancement', { text: '+2, +1 per 3 caster levels above 3rd (max +5); cl = your caster level' })],
    'Divine Favor': [B('atk', 'max(1, min(3, floor(cl / 3)))', 'Luck'), B('dmg', 'max(1, min(3, floor(cl / 3)))', 'Luck')],
    'Prayer': [B('atk', 1, 'Luck'), B('dmg', 1, 'Luck'), B('saves', 1, 'Luck'), B('skills', 1, 'Luck'), B('note', '', 'Luck', { text: 'Enemies take -1 on the same rolls' })],
    'Resistance': [B('saves', 1, 'Resistance')],
    'Aid': [B('atk', 1, 'Morale'), B('note', '', 'Morale', { text: '+1 morale on saves against fear; temporary HP 1d8 + CL (max +10)' })],
    'Guidance': [B('note', '', 'Competence', { text: '+1 competence on one attack, save or skill check' })],
    'Magic Vestment': [B('note', '', 'Enhancement', { text: '+1 enhancement to armor or shield per 4 caster levels (max +5)' })],
    "Bull's Strength": [B('str', 4, 'Enhancement')],
    "Cat's Grace": [B('dex', 4, 'Enhancement')],
    "Bear's Endurance": [B('con', 4, 'Enhancement')],
    'Shield of Faith': [B('ac', 2, 'Deflection')],
    'Rage (spell)': [B('str', 2, 'Morale'), B('con', 2, 'Morale'), B('will', 1, 'Morale'), B('ac', -2, 'Untyped (stacks)')],
    'Protection from Evil': [B('note', '', 'Deflection', { text: '+2 deflection to AC and +2 resistance on saves against evil creatures' })],
    'Animal Growth / Enlarge': [B('str', 2, 'Size'), B('dex', -2, 'Size'), B('note', '', 'Size', { text: 'Also change Size one step larger while active' })],
  };

  function blankCompanion(kind) {
    const k = KINDS.includes(kind) ? kind : 'Animal Companion';
    return {
      id: M.uid(), kind: k, name: '', species: '', size: k === 'Familiar' ? 'Tiny' : 'Medium',
      level: '',            // Animal Companion: effective druid level; Familiar: master level (blank = your level)
      hd: 1, hdSize: 8, babProg: 'medium', goodSaves: { fort: true, ref: true, will: false }, // Other only
      // Eidolons start with the APG biped base form's scores; others with typical animal scores.
      abilities: k === 'Eidolon'
        ? { str: { base: 16, adj: 0 }, dex: { base: 12, adj: 0 }, con: { base: 13, adj: 0 }, int: { base: 7, adj: 0 }, wis: { base: 10, adj: 0 }, cha: { base: 11, adj: 0 } }
        : { str: { base: 10, adj: 0 }, dex: { base: 10, adj: 0 }, con: { base: 10, adj: 0 }, int: { base: 2, adj: 0 }, wis: { base: 12, adj: 0 }, cha: { base: 6, adj: 0 } },
      natural: 0, armor: 0, deflect: 0, dodge: 0, acMisc: 0,
      hpMisc: 0, hpOverride: '', damage: 0, temp: 0,
      saveMisc: { fort: 0, ref: 0, will: 0 }, initMisc: 0, atkMisc: 0,
      baseForm: 'Biped', evolutions: [],   // Eidolon only
      multiattack: false, powerAttack: false, speed: '', senses: '', dr: '',
      resources: [], buffs: [], gear: [], conditions: [], spells: [],
      attacks: [], skills: [], feats: [], tricks: '', special: '', notes: '',
    };
  }
  function normalize(c) {
    const b = blankCompanion(c.kind);
    for (const k of Object.keys(b)) if (c[k] === undefined || c[k] === null) c[k] = b[k];
    for (const a of ABIL) if (!c.abilities[a]) c.abilities[a] = b.abilities[a];
    if (!c.id) c.id = M.uid();
    for (const k of ['feats', 'gear', 'evolutions', 'buffs']) (c[k] || []).forEach(x => { if (!Array.isArray(x.bonuses)) x.bonuses = []; });
    (c.spells || []).forEach(x => { if (!x.id) x.id = M.uid(); });
    return c;
  }

  const n = x => { const v = typeof x === 'number' ? x : parseFloat(x); return Number.isFinite(v) ? v : 0; };
  const isNum = x => x !== '' && x !== null && x !== undefined && Number.isFinite(typeof x === 'number' ? x : parseFloat(x));
  const mod = s => Math.max(-5, Math.floor((s - 10) / 2));
  const good = hd => 2 + Math.floor(hd / 2), poor = hd => Math.floor(hd / 3);

  function compute(c, master) {
    const out = { kind: c.kind, special: [] };
    const masterLevel = master ? master.level : 0;
    // Blank level: eidolons follow your summoner levels, others your total level
    let defLevel = masterLevel || 1;
    if (c.kind === 'Eidolon' && master) { const s = master.classes.find(x => x.data && /summoner/i.test(x.name)); if (s) defLevel = s.level; }
    const lvl = Math.max(1, Math.min(20, Math.floor(isNum(c.level) ? n(c.level) : defLevel)));
    out.effLevel = lvl;
    let hd, bab, base, natBonus = 0, physBonus = 0, tricks = null, hdSize = 8, intMin = null;

    if (c.kind === 'Animal Companion') {
      const row = AC_TABLE[lvl - 1];
      hd = row[0]; natBonus = row[1]; physBonus = row[2]; tricks = row[3];
      bab = Math.floor(hd * 3 / 4);
      base = { fort: good(hd), ref: good(hd), will: poor(hd) };
      for (let i = 0; i < lvl; i++) if (AC_TABLE[i][4]) out.special.push(AC_TABLE[i][4]);
    } else if (c.kind === 'Eidolon') {
      const i = lvl - 1;
      hd = EIDOLON.hd[i]; bab = hd; hdSize = 10;
      natBonus = EIDOLON.armor[i]; physBonus = EIDOLON.phys[i];
      const g = BASE_FORMS[c.baseForm] || BASE_FORMS.Biped;
      base = { fort: g.fort ? good(hd) : poor(hd), ref: g.ref ? good(hd) : poor(hd), will: g.will ? good(hd) : poor(hd) };
      for (let L = 1; L <= lvl; L++) if (EIDOLON.special[L]) out.special.push(EIDOLON.special[L]);
      out.evolutionPool = EIDOLON.pool[i];
      out.maxAttacks = EIDOLON.maxAttacks[i];
      out.evolutionsUsed = (c.evolutions || []).reduce((t, e) => t + n(e.cost), 0);
    } else if (c.kind === 'Familiar') {
      hd = lvl;
      bab = master ? master.bab : Math.floor(hd * 3 / 4);
      const ownHd = Math.max(1, Math.floor(n(c.hd)) || 1);   // the creature's own Hit Dice (1 for most familiars)
      const own = { fort: good(ownHd), ref: good(ownHd), will: poor(ownHd) };
      const ms = master ? master.baseSaves : own;
      base = { fort: Math.max(own.fort, ms.fort), ref: Math.max(own.ref, ms.ref), will: Math.max(own.will, ms.will) };
      natBonus = Math.ceil(lvl / 2);
      intMin = 5 + Math.ceil(lvl / 2);
      FAMILIAR_SPECIAL.forEach(([L, s]) => { if (lvl >= L) out.special.push(s); });
    } else {
      hd = Math.max(1, Math.floor(n(c.hd)) || 1);
      hdSize = n(c.hdSize) || 8;
      bab = c.babProg === 'full' ? hd : c.babProg === 'poor' ? Math.floor(hd / 2) : Math.floor(hd * 3 / 4);
      const g = c.goodSaves || {};
      base = { fort: g.fort ? good(hd) : poor(hd), ref: g.ref ? good(hd) : poor(hd), will: g.will ? good(hd) : poor(hd) };
    }
    out.hd = hd; out.bab = bab; out.baseSaves = base; out.natBonus = natBonus; out.physBonus = physBonus; out.tricks = tricks;

    // ---- Bonuses: buffs, feats, gear, evolutions and conditions, with the same stacking rules as the character
    const E = window.PF_ENGINE;
    const baseScore = a => {
      const ab = c.abilities[a] || { base: 10, adj: 0 };
      if (String(ab.base).trim() === '-' || String(ab.base).trim() === '') return null;
      let s = n(ab.base) + n(ab.adj) + ((a === 'str' || a === 'dex') ? physBonus : 0);
      if (a === 'int' && intMin !== null) s = Math.max(s, intMin);
      return s;
    };
    const vars = mods => Object.assign({ level: hd, bab, cl: (master && master.formulaVars && master.formulaVars.cl) || 0, C: Object.assign({}, (master && master.formulaVars && master.formulaVars.C) || {}) }, mods);
    const scoresFrom = rows => {
      const ab = {}, md = {};
      for (const a of ABIL) {
        const b = baseScore(a);
        if (b === null) { ab[a] = { score: null, mod: 0, bonus: 0 }; md[a] = 0; continue; }
        const bonus = rows ? E.stack(rows, a) : 0;
        const score = Math.max(0, b + bonus);
        ab[a] = { score, mod: mod(score), bonus }; md[a] = mod(score);
      }
      return { ab, md };
    };
    let pass = scoresFrom(null);
    const ctx = {};
    let rows = bonusRows(c, vars(pass.md), ctx);
    pass = scoresFrom(rows);
    const V = vars(pass.md);
    rows = bonusRows(c, V, ctx);
    pass = scoresFrom(rows);
    out.abilities = pass.ab; out.mods = pass.md; out.rows = rows; out.formulaVars = V;
    out.overlaps = E.findOverlaps ? E.findOverlaps(rows) : [];
    out.loseDex = !!ctx.loseDex;
    const m = out.mods;
    const size = M.SIZES.find(s => s.name === c.size) || M.SIZES[4];
    out.size = size;
    const T = key => E.stack(rows, key);

    // Hit points
    const avg = (hdSize + 1) / 2;
    let hpMax = Math.floor(avg * hd) + m.con * hd + n(c.hpMisc) + T('hp');
    if (c.kind === 'Familiar' && master) hpMax = Math.floor(master.hp.max / 2) + n(c.hpMisc) + T('hp');
    if (isNum(c.hpOverride)) hpMax = n(c.hpOverride);
    out.hp = { max: hpMax, current: hpMax - Math.abs(n(c.damage)) + n(c.temp), bonus: T('hp') };

    // Defense: manual fields compete with same-type bonuses (armor, deflection); dodge stacks
    const armorFx = E.posNeg(rows, 'ac', 'Armor'), deflFx = E.posNeg(rows, 'ac', 'Deflection');
    const dodgeFx = E.stack(rows, 'ac', t => t === 'Dodge (stacks)');
    const tempAc = E.stack(rows, 'ac', t => t !== 'Armor' && t !== 'Deflection' && t !== 'Dodge (stacks)');
    let dexAc = m.dex, dodge = n(c.dodge) + dodgeFx;
    if (ctx.loseDex) { dexAc = Math.min(0, dexAc); dodge = Math.min(0, dodge); }
    const parts = {
      armor: Math.max(n(c.armor), armorFx.pos) + armorFx.neg, dex: dexAc, size: size.atk,
      natural: n(c.natural) + natBonus + T('nat'), deflect: Math.max(n(c.deflect), deflFx.pos) + deflFx.neg,
      dodge, misc: n(c.acMisc), temp: tempAc,
    };
    out.ac = {
      parts,
      total: 10 + parts.armor + parts.dex + parts.size + parts.natural + parts.deflect + parts.dodge + parts.misc + parts.temp,
      touch: 10 + parts.dex + parts.size + parts.deflect + parts.dodge + parts.misc + parts.temp,
      flat: 10 + parts.armor + Math.min(0, parts.dex) + parts.size + parts.natural + parts.deflect + Math.min(0, parts.dodge) + parts.misc + parts.temp,
    };
    out.cmb = bab + m.str + size.cmb + T('mAtk') + T('cmb');
    out.cmd = 10 + bab + m.str + parts.dex + size.cmb + parts.deflect + parts.dodge + parts.temp + T('cmd');
    let initText = 0;
    for (const r of rows) if (/initiative/i.test(r.text || '')) { const mm = String(r.text).match(/[-+]?\d+/); if (mm) initText += parseInt(mm[0], 10); }
    out.init = m.dex + n(c.initMisc) + T('init') + initText;

    // Saves
    const saveAb = { fort: 'con', ref: 'dex', will: 'wis' };
    out.saves = {};
    for (const s of ['fort', 'ref', 'will']) {
      const bonus = T(s), misc = n(c.saveMisc && c.saveMisc[s]);
      out.saves[s] = { base: base[s], ability: m[saveAb[s]], misc, bonus, total: base[s] + m[saveAb[s]] + misc + bonus };
    }

    // Attacks (natural or manufactured; each listed attack is rolled once on a full attack)
    const pa = c.powerAttack ? Math.floor(bab / 4) + 1 : 0;
    out.powerAttack = pa;
    const wRows = rows.filter(r => r.weapon);
    out.attacks = (c.attacks || []).map(a => {
      const abil = ABIL.includes(a.ability) ? a.ability : 'str';
      const secondary = a.secondary === true || a.secondary === 'true';
      const mult = isNum(a.dmgMult) ? n(a.dmgMult) : (secondary ? 0.5 : 1);
      const ranged = a.ranged === true;
      const mine = wRows.filter(r => String(a.name || '').toLowerCase().includes(r.weapon.toLowerCase()));
      const fxAtk = ranged ? T('rAtk') : T('mAtk');
      const fxDmg = ranged ? T('rDmg') : T('mDmg');
      const atk = bab + m[abil] + size.atk + n(a.misc) + n(c.atkMisc) + fxAtk + E.stack(mine, 'wAtk')
        + (secondary ? (c.multiattack ? -2 : -5) : 0) - (ranged ? 0 : pa);
      // Power Attack: +2 damage per -1 (x1.5 for Str x1.5 attacks, half for secondary/off-hand)
      const paDmg = ranged || !pa ? 0 : Math.floor(pa * 2 * (mult >= 1.5 ? 1.5 : mult < 1 ? 0.5 : 1));
      const dmg = Math.floor(m.str * mult) + n(a.dmgMisc) + paDmg + fxDmg + E.stack(mine, 'wDmg');
      const count = Math.max(1, Math.min(8, Math.floor(n(a.count)) || 1));
      const list = Array(count).fill(atk);
      if (a.iterative) for (let i = 1, it = Math.max(1, 1 + Math.floor((bab - 1) / 5)); i < Math.min(4, it); i++) list.push(atk - 5 * i);
      const sign = x => (x >= 0 ? '+' : '') + x;
      return {
        attackBonus: atk, attacks: list, damageBonus: dmg, attackText: list.map(sign).join(' / '),
        damageText: (a.dice ? a.dice + ' ' : '') + (dmg >= 0 ? '+ ' : '- ') + Math.abs(dmg), valid: true,
      };
    });

    // Skills
    const meta = window.PF_DATA.skillMeta;
    const ranksPer = Math.max(1, (c.kind === 'Eidolon' ? 4 : 2) + m.int);
    out.skillRanks = { used: (c.skills || []).reduce((t, s) => t + n(s.ranks), 0), available: ranksPer * hd };
    const key = s => String(s || '').replace(/:$/, '').trim().toLowerCase();
    out.skills = (c.skills || []).map(s => {
      const info = meta[s.name] || { ability: 'Dex', acp: false };
      const ab = M.ABBR_TO_KEY[info.ability] || 'dex';
      const ranks = n(s.ranks);
      const isClass = s.classSkill === true || (c.kind === 'Animal Companion' && AC_SKILLS.includes(s.name));
      let sizeMod = 0;
      if (s.name === 'Stealth') sizeMod = size.stealth;
      if (s.name === 'Fly') sizeMod = size.fly;
      // bonuses aimed at this skill (formulas may use its ranks) plus "all skills", stacked by type
      const byType = new Map();
      for (const r of rows) {
        const vals = [];
        if (r.skill && key(r.skill) === key(s.name)) { const x = E.evalBonus(r.formula, Object.assign({}, V, { ranks })); if (x !== null) vals.push(x); }
        if (isNum(r.v && r.v.skills)) vals.push(n(r.v.skills));
        if (r.text && s.name && !r.skill && r.text.toLowerCase().includes(s.name.toLowerCase())) { const mm = String(r.text).match(/[-+]?\d+/); if (mm) vals.push(parseInt(mm[0], 10)); }
        if (!vals.length) continue;
        const t = r.type || 'Untyped (stacks)';
        if (!byType.has(t)) byType.set(t, []);
        byType.get(t).push(...vals);
      }
      let temp = 0;
      for (const [t, vals] of byType) temp += E.typeTotal(t, vals);
      const total = ranks + m[ab] + (isClass && ranks > 0 ? 3 : 0) + n(s.misc) + sizeMod + temp;
      return { name: s.name, ranks, ability: info.ability, isClass, temp, total };
    });
    out.featsAllowed = Math.ceil(hd / 2);
    // Touch attacks for the companion's spells and abilities
    out.touchRanged = bab + m.dex + size.atk + T('rAtk');
    out.touchMelee = bab + m.str + size.atk + T('mAtk');
    return out;
  }

  // Bonus rows for a companion: active buffs, feats, gear, evolutions, and conditions.
  function bonusRows(c, V, ctx) {
    const E = window.PF_ENGINE;
    const rows = [];
    for (const b of c.buffs || []) if (b.active) E.pushBonuses(rows, b.bonuses || [], 'buff', x => x.label || b.name || 'Buff', 'Untyped (stacks)', V);
    for (const f of c.feats || []) E.pushBonuses(rows, f.bonuses || [], 'feat', x => x.label || f.name || 'Feat', 'Untyped (stacks)', V);
    for (const g of c.gear || []) E.pushBonuses(rows, g.bonuses || [], 'gear', x => x.label || g.item || g.slot || 'Gear', 'Enhancement', V);
    for (const e of c.evolutions || []) E.pushBonuses(rows, e.bonuses || [], 'evolution', x => x.label || e.name || 'Evolution', 'Untyped (stacks)', V);
    ctx.loseDex = false;
    const condMap = new Map(window.PF_DATA.conditions.map(x => [x.name, x]));
    for (const name of c.conditions || []) {
      const cd = condMap.get(name);
      if (!cd) continue;
      const v = {};
      for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha', 'fort', 'ref', 'will', 'mAtk', 'mDmg', 'rAtk', 'rDmg', 'skills']) if (isNum(cd[k])) v[k] = n(cd[k]);
      if (typeof cd.ac === 'string' && cd.ac.startsWith('LOSEDEX')) { ctx.loseDex = true; v.ac = n(cd.ac.slice(7)); }
      else if (isNum(cd.ac)) v.ac = n(cd.ac);
      rows.push({ src: 'condition', name, type: 'Untyped (stacks)', v, text: cd.skillText || '' });
    }
    return rows;
  }

  window.PF_COMPANION = { KINDS, AC_SKILLS, BASE_FORMS, BUFF_PRESETS, blankCompanion, normalize, compute };
})();
