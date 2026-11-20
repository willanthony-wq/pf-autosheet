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
      resources: [],
      attacks: [], skills: [], feats: [], tricks: '', special: '', notes: '',
    };
  }
  function normalize(c) {
    const b = blankCompanion(c.kind);
    for (const k of Object.keys(b)) if (c[k] === undefined || c[k] === null) c[k] = b[k];
    for (const a of ABIL) if (!c.abilities[a]) c.abilities[a] = b.abilities[a];
    if (!c.id) c.id = M.uid();
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
      const own = { fort: good(hd), ref: good(hd), will: poor(hd) };
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

    // Abilities
    out.abilities = {};
    out.mods = {};
    for (const a of ABIL) {
      const ab = c.abilities[a] || { base: 10, adj: 0 };
      // "-" (or blank) = no score, e.g. a construct's Con and Int: counts as modifier 0
      if (String(ab.base).trim() === '-' || String(ab.base).trim() === '') { out.abilities[a] = { score: null, mod: 0 }; out.mods[a] = 0; continue; }
      let score = n(ab.base) + n(ab.adj) + ((a === 'str' || a === 'dex') ? physBonus : 0);
      if (a === 'int' && intMin !== null) score = Math.max(score, intMin);
      score = Math.max(0, score);
      out.abilities[a] = { score, mod: mod(score) };
      out.mods[a] = mod(score);
    }
    const m = out.mods;
    const size = M.SIZES.find(s => s.name === c.size) || M.SIZES[4];
    out.size = size;

    // Hit points
    const avg = (hdSize + 1) / 2;
    let hpMax = Math.floor(avg * hd) + m.con * hd + n(c.hpMisc);
    if (c.kind === 'Familiar' && master) hpMax = Math.floor(master.hp.max / 2) + n(c.hpMisc);
    if (isNum(c.hpOverride)) hpMax = n(c.hpOverride);
    out.hp = { max: hpMax, current: hpMax - Math.abs(n(c.damage)) + n(c.temp) };

    // Defense
    const natural = n(c.natural) + natBonus;
    const parts = { armor: n(c.armor), dex: m.dex, size: size.atk, natural, deflect: n(c.deflect), dodge: n(c.dodge), misc: n(c.acMisc) };
    out.ac = {
      parts,
      total: 10 + parts.armor + parts.dex + parts.size + parts.natural + parts.deflect + parts.dodge + parts.misc,
      touch: 10 + parts.dex + parts.size + parts.deflect + parts.dodge + parts.misc,
      flat: 10 + parts.armor + Math.min(0, parts.dex) + parts.size + parts.natural + parts.deflect + Math.min(0, parts.dodge) + parts.misc,
    };
    out.cmb = bab + m.str + size.cmb;
    out.cmd = 10 + bab + m.str + m.dex + size.cmb + parts.deflect + parts.dodge;
    out.init = m.dex + n(c.initMisc);

    // Saves
    const saveAb = { fort: 'con', ref: 'dex', will: 'wis' };
    out.saves = {};
    for (const s of ['fort', 'ref', 'will']) {
      out.saves[s] = { base: base[s], ability: m[saveAb[s]], misc: n(c.saveMisc && c.saveMisc[s]), total: base[s] + m[saveAb[s]] + n(c.saveMisc && c.saveMisc[s]) };
    }

    // Attacks (natural or manufactured; each listed attack is rolled once on a full attack)
    const pa = c.powerAttack ? Math.floor(bab / 4) + 1 : 0;
    out.powerAttack = pa;
    out.attacks = (c.attacks || []).map(a => {
      const abil = ABIL.includes(a.ability) ? a.ability : 'str';
      const secondary = a.secondary === true || a.secondary === 'true';
      const mult = isNum(a.dmgMult) ? n(a.dmgMult) : (secondary ? 0.5 : 1);
      const ranged = a.ranged === true;
      const atk = bab + m[abil] + size.atk + n(a.misc) + n(c.atkMisc) + (secondary ? (c.multiattack ? -2 : -5) : 0) - (ranged ? 0 : pa);
      // Power Attack: +2 damage per -1 (x1.5 for Str x1.5 attacks, half for secondary/off-hand)
      const paDmg = ranged || !pa ? 0 : Math.floor(pa * 2 * (mult >= 1.5 ? 1.5 : mult < 1 ? 0.5 : 1));
      const dmg = (abil === 'str' || !a.dmgAbility ? Math.floor(m.str * mult) : Math.floor(m[a.dmgAbility] * mult)) + n(a.dmgMisc) + paDmg;
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
    out.skills = (c.skills || []).map(s => {
      const info = meta[s.name] || { ability: 'Dex', acp: false };
      const ab = M.ABBR_TO_KEY[info.ability] || 'dex';
      const ranks = n(s.ranks);
      const isClass = s.classSkill === true || (c.kind === 'Animal Companion' && AC_SKILLS.includes(s.name));
      let sizeMod = 0;
      if (s.name === 'Stealth') sizeMod = size.stealth;
      if (s.name === 'Fly') sizeMod = size.fly;
      const total = ranks + m[ab] + (isClass && ranks > 0 ? 3 : 0) + n(s.misc) + sizeMod;
      return { name: s.name, ranks, ability: info.ability, isClass, total };
    });
    out.featsAllowed = Math.ceil(hd / 2);
    return out;
  }

  window.PF_COMPANION = { KINDS, AC_SKILLS, BASE_FORMS, blankCompanion, normalize, compute };
})();
