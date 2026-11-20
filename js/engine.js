// Calculation engine: a port of the Pathfinder Autosheet v6.2.1 formulas.
// compute(character) -> derived values. Pure function; never mutates the character.
(function () {
  'use strict';
  const D = window.PF_DATA;
  const M = window.PF_MODEL;
  const { ABILITIES, STACKING_TYPES, SIZES, AGE, XP } = M;

  const classByName = new Map(D.classes.map(c => [c.name, c]));
  const DER = 'Deflect/Enhance/Resist';
  const BACKGROUND_SKILLS = new Set(['Appraise', 'Artistry:', 'Craft:', 'Handle Animal', 'Kn. Engineering', 'Kn. Geography',
    'Kn. History', 'Kn. Nobility', 'Linguistics', 'Lore:', 'Perform:', 'Prof:', 'Sleight of Hand']);
  const FLIGHT = { Clumsy: -8, Poor: -4, Average: 0, Good: 4, Perfect: 8 };
  const LOAD_RANK = { Unarmored: 0, Light: 1, Medium: 2, Heavy: 3, Overloaded: 4 };
  const ENCUMBRANCE = { Light: { maxDex: null, acp: 0 }, Medium: { maxDex: 3, acp: -3 }, Heavy: { maxDex: 1, acp: -6 }, Overloaded: { maxDex: 0, acp: -6 } };

  function n(x) {
    if (x === '' || x === null || x === undefined || typeof x === 'boolean') return 0;
    const v = typeof x === 'number' ? x : parseFloat(String(x).replace(/^\+/, ''));
    return Number.isFinite(v) ? v : 0;
  }
  function isNum(x) { return x !== '' && x !== null && x !== undefined && Number.isFinite(typeof x === 'number' ? x : parseFloat(x)); }
  function mod(score) { return Math.max(-5, Math.floor((score - 10) / 2)); }
  function sign(x) { return (x >= 0 ? '+' : '') + x; }

  // ---------- Formula evaluation for attack styles ----------
  const exprCache = new Map();
  const H = {
    MAX: (...a) => Math.max(...a.map(n)), FL: x => Math.floor(n(x)), RD: x => Math.trunc(n(x)),
    IF: (c, a, b) => (c ? a : (b === undefined ? 0 : b)),
  };
  function evalExpr(expr, v) {
    if (expr === null || expr === undefined || String(expr).trim() === '') return null;
    let f = exprCache.get(expr);
    if (!f) {
      f = new Function('v', 'H', 'const {MAX,FL,RD,IF}=H; return (' + expr + ');');
      exprCache.set(expr, f);
    }
    try { return n(f(v, H)); } catch (e) { return null; }
  }

  // ---------- Effect stacking ----------
  // A column value can be a number, or (for speed) a multiplier string like "x0.5".
  function colValues(rows, key, typeFilter) {
    const byType = new Map();
    for (const r of rows) {
      const raw = r.v ? r.v[key] : undefined;
      if (!isNum(raw)) continue;
      if (typeFilter && !typeFilter(r.type)) continue;
      const t = r.type || 'Untyped (stacks)';
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t).push(n(raw));
    }
    return byType;
  }
  function typeTotal(type, vals) {
    if (STACKING_TYPES.includes(type)) return vals.reduce((a, b) => a + b, 0);
    const pos = vals.filter(x => x > 0), neg = vals.filter(x => x < 0);
    return (pos.length ? Math.max(...pos) : 0) + neg.reduce((a, b) => a + b, 0);
  }
  // Sum of per-type totals (or the max of them, for attack-count columns).
  function stack(rows, key, typeFilter, combine) {
    const byType = colValues(rows, key, typeFilter);
    const totals = [...byType.entries()].map(([t, vals]) => typeTotal(t, vals));
    if (!totals.length) return 0;
    return combine === 'max' ? Math.max(...totals) : totals.reduce((a, b) => a + b, 0);
  }
  function posNeg(rows, key, type) {
    const vals = (colValues(rows, key, t => t === type).get(type)) || [];
    const pos = vals.filter(x => x > 0), neg = vals.filter(x => x < 0);
    return { pos: pos.length ? Math.max(...pos) : 0, neg: neg.reduce((a, b) => a + b, 0) };
  }
  function multipliers(rows, key) {
    let m = 1, any = false;
    for (const r of rows) {
      const raw = r.v ? r.v[key] : undefined;
      if (typeof raw === 'string' && /^\s*x/i.test(raw)) { m *= n(raw.replace(/^\s*x/i, '')); any = true; }
    }
    return any ? m : 1;
  }
  function firstNumber(text) {
    const m = String(text || '').match(/[-+]?\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  // ---------- Effect rows ----------
  function buildEffectRows(ch, ctx) {
    const rows = [];
    for (const e of ch.effects) if (e.active) rows.push({ src: 'effect', name: e.name, type: e.type, v: e.v || {}, text: e.text || '' });

    const pa = Math.floor(ctx.bab / 4) + 1;
    for (const t of ch.toggles) {
      if (!t.active) continue;
      const v = Object.assign({}, t.v || {});
      if (t.auto === 'powerAttack') Object.assign(v, { mAtk: -pa, mDmg: 2 * pa, ohDmg: -pa, thDmg: pa });
      if (t.auto === 'combatExpertise') Object.assign(v, { ac: pa, mAtk: -pa });
      if (t.auto === 'deadlyAim') Object.assign(v, { rAtk: -pa, rDmg: 2 * pa });
      if (t.auto === 'haste') {
        v.speed = Math.min(30, ctx.speedBase.base);
        for (const k of ['fly', 'swim', 'burrow', 'climb']) if (isNum(ctx.speedBase[k])) v[k] = Math.min(30, n(ctx.speedBase[k]));
      }
      rows.push({ src: 'toggle', name: t.name, type: t.type, v, text: t.text || '' });
    }

    for (const it of ch.magicItems) {
      if (!isNum(it.value) || it.active === false) continue;
      const v = {};
      if (it.target === 'Saves') Object.assign(v, { fort: n(it.value), ref: n(it.value), will: n(it.value) });
      else if (it.target === 'AC') v.ac = n(it.value);
      else if (it.target === 'NatAC') v.nat = n(it.value);
      rows.push({ src: 'item', name: it.name || 'Magic item', type: it.type, v, text: '' });
    }

    ctx.loseDex = false; ctx.chargeMult = 1; ctx.runMult = 1;
    const condMap = new Map(D.conditions.map(c => [c.name, c]));
    for (const name of ch.conditions) {
      const c = condMap.get(name);
      if (!c) continue;
      const v = {};
      for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha', 'fort', 'ref', 'will', 'mAtk', 'mDmg', 'rAtk', 'rDmg', 'skills', 'cl']) {
        if (isNum(c[k])) v[k] = n(c[k]);
      }
      if (typeof c.ac === 'string' && c.ac.startsWith('LOSEDEX')) { ctx.loseDex = true; v.ac = n(c.ac.slice(7)); }
      else if (isNum(c.ac)) v.ac = n(c.ac);
      if (isNum(c.speedMult)) v.speed = 'x' + c.speedMult;
      if (isNum(c.chargeMult)) ctx.chargeMult *= n(c.chargeMult);
      if (isNum(c.runMult)) ctx.runMult *= n(c.runMult);
      rows.push({ src: 'condition', name, type: 'Untyped (stacks)', v, text: c.skillText || '' });
    }

    const nl = n(ch.negativeLevels);
    if (nl > 0) {
      rows.push({ src: 'condition', name: 'Negative Levels', type: 'Untyped (stacks)',
        v: { fort: -nl, ref: -nl, will: -nl, mAtk: -nl, rAtk: -nl, skills: -nl, cl: -nl }, text: '' });
    }
    if (ch.settings.woundThresholds && ctx.hpMax > 0) {
      const ratio = ctx.hpCurrent / ctx.hpMax;
      const p = ratio < 0.25 ? -3 : ratio < 0.5 ? -2 : ratio < 0.75 ? -1 : 0;
      ctx.woundState = p === -3 ? 'Critical: -3 to all actions and defenses' : p === -2 ? 'Wounded: -2 to all actions and defenses'
        : p === -1 ? 'Grazed: -1 to all actions and defenses' : 'Healthy: no penalties';
      if (p) rows.push({ src: 'condition', name: 'Wound Threshold', type: 'Untyped (stacks)',
        v: { ac: p, fort: p, ref: p, will: p, mAtk: p, rAtk: p, skills: p, cl: p }, text: '' });
    }
    return rows;
  }

  // ---------- Main compute ----------
  function compute(ch) {
    const d = { warnings: [] };

    // Classes, level, BAB, base saves
    d.classes = ch.classes.map((c, i) => {
      const data = getClass(ch, c.name);
      const level = Math.max(0, Math.floor(n(c.level)));
      if (!data || level < 1) return { name: c.name, level, data, bab: null, fort: null, ref: null, will: null, hd: data ? data.hd : null, ranksPerLevel: null };
      const prog = p => p === 'Good' ? 2 + Math.floor(level / 2) : p === 'Poor' ? Math.floor(level / 3)
        : p === 'Prestige Good' ? Math.floor((level + 1) / 2) : p === 'Prestige Poor' ? Math.floor((level + 1) / 3) : 0;
      return { name: c.name, level, data, hd: data.hd, bab: Math.floor(data.bab * level), fort: prog(data.fort), ref: prog(data.ref), will: prog(data.will) };
    });
    d.level = d.classes.reduce((a, c) => a + (c.data ? c.level : 0), 0);
    d.bab = d.classes.reduce((a, c) => a + (c.bab || 0), 0);
    d.baseSaves = { fort: 0, ref: 0, will: 0 };
    d.classes.forEach(c => { d.baseSaves.fort += c.fort || 0; d.baseSaves.ref += c.ref || 0; d.baseSaves.will += c.will || 0; });

    // Pre-pass: effect rows need BAB, base speeds and HP (for wound thresholds). HP needs Con,
    // which needs effects, so compute abilities from effects that don't depend on HP first.
    const ctx = { bab: d.bab, speedBase: { base: n(ch.info.speeds.base), fly: ch.info.speeds.fly, swim: ch.info.speeds.swim, burrow: ch.info.speeds.burrow, climb: ch.info.speeds.climb }, hpMax: 0, hpCurrent: 0 };
    let rows = buildEffectRows(ch, Object.assign({}, ctx, { hpMax: 0 }));
    computeAbilities(ch, d, rows);
    computeHp(ch, d);
    ctx.hpMax = d.hp.max; ctx.hpCurrent = d.hp.current;
    rows = buildEffectRows(ch, ctx);
    computeAbilities(ch, d, rows);  // wound thresholds don't touch abilities, but recompute for consistency
    d.rows = rows;
    d.loseDex = ctx.loseDex;
    d.woundState = ctx.woundState || '';

    // Effect totals row (for the effect table footer)
    d.effectTotals = {};
    for (const c of M.EFFECT_COLS) {
      d.effectTotals[c.key] = stack(rows, c.key, null, ['twf', 'xMelee', 'xRanged'].includes(c.key) ? 'max' : 'sum');
    }
    const T = d.effectTotals;

    // Size
    const baseIdx = Math.max(0, SIZES.findIndex(s => s.name === ch.info.size));
    d.size = SIZES[Math.min(8, Math.max(0, baseIdx + Math.round(T.size)))];

    // XP
    const xpTable = XP.table[ch.info.xpTrack] || XP.table.Medium;
    d.xpNextLevel = d.level >= 1 && d.level < 20 ? xpTable[d.level] : null;
    d.xpToNext = d.xpNextLevel !== null ? Math.max(0, d.xpNextLevel - n(ch.info.xp)) : null;

    computeArmor(ch, d);
    computeDefenses(ch, d, rows);
    computeSkills(ch, d, rows);
    computeMovement(ch, d, rows, ctx);
    computeSpells(ch, d);
    computeAttacks(ch, d);
    return d;
  }

  function computeAbilities(ch, d, rows) {
    d.abilities = {};
    const ageIdx = Math.max(0, AGE.categories.indexOf(ch.info.age));
    for (const a of ABILITIES) {
      const ab = ch.abilities[a];
      const der = posNeg(rows, a, DER);
      const others = stack(rows, a, t => t !== DER);
      const enh = n(ab.enh);
      const temp = Math.max(0, der.pos - enh) + der.neg + others;
      const age = AGE.mods[a][ageIdx];
      const score = Math.max(0, n(ab.base) + enh + n(ab.inh) + temp - Math.abs(n(ab.pen)) + age);
      d.abilities[a] = { score, mod: mod(score), temp, age };
    }
    d.mods = {};
    for (const a of ABILITIES) d.mods[a] = d.abilities[a].mod;
  }

  function computeHp(ch, d) {
    const con = d.mods.con;
    const f = ch.info.hpFormula;
    let total = 0;
    d.classes.forEach((c, i) => {
      if (!c.data || c.level < 1) return;
      const L = c.level, Hd = c.hd;
      const avg = (Hd + 1) / 2, avgUp = Math.floor(Hd / 2 + 1);
      if (f === 'Average') total += (avg + con) * L;
      else if (f === 'Average (1st level max)') total += i === 0 ? Math.max(0, (avg + con) * (L - 1) + Hd + con) : (avg + con) * L;
      else if (f === 'Average round up') total += (avgUp + con) * L;
      else if (f === 'Average round up (1st level max)') total += i === 0 ? Math.max(0, (avgUp + con) * (L - 1) + Hd + con) : (avgUp + con) * L;
      else if (f === 'Maximum') total += (Hd + con) * L;
      else if (f === 'Custom Rolled') {
        const rolls = Array.isArray(ch.rolledHp[i]) ? ch.rolledHp[i] : String(ch.rolledHp[i] || '').split(/[\s,;]+/);
        total += rolls.reduce((a, b) => a + n(b), 0) + con * L;
      }
    });
    const nl = n(ch.negativeLevels);
    const max = Math.floor(total) + n(ch.fcb.hp) - 5 * nl;
    const current = max - Math.abs(n(ch.hp.damage)) + n(ch.hp.temp) - n(ch.hp.nonlethal);
    d.hp = { max, current, base: Math.floor(total) + n(ch.fcb.hp) };
  }

  function getClass(ch, name) {
    if (!name) return null;
    return (ch.customClasses || []).find(c => c.name === name) || classByName.get(name) || null;
  }
  function attackOptions(ch, category) {
    const cat = D.attackCategories.find(c => c.name === category);
    return (cat ? cat.options : []).concat((ch.customAttackOptions || []).filter(o => o.category === category));
  }

  function lookup(list, name) { return list.find(x => x.name === name) || null; }

  function computeArmor(ch, d) {
    function piece(p, table) {
      const it = lookup(table, p.item);
      const mat = lookup(D.materials, p.material);
      const enhNum = isNum(p.enh) ? n(p.enh) : 0;
      const mwk = enhNum > 0 || p.enh === 'Mwk' || p.enh === 'Masterwork';
      const ac = enhNum + (it ? it.ac : 0) + (mat ? mat.ac : 0);
      const acp = it ? Math.min(0, -it.acp + (mat ? mat.acp : 0) + n(p.mSkill) + (mwk ? 1 : 0)) : Math.min(0, n(p.mSkill));
      const maxDex = it && isNum(it.maxDex) ? it.maxDex + (mat ? mat.maxDex : 0) + n(p.mDex) : null;
      const asf = it ? Math.max(0, it.asf + (mat ? mat.asf : 0)) : 0;
      const weight = it && it.type in LOAD_RANK && table === D.armor ? LOAD_RANK[it.type] + (mat ? mat.weight : 0) : 0;
      return { ac, acp, maxDex, asf, weight, note: mat && mat.note ? mat.note : '' };
    }
    const a = piece(ch.armor, D.armor), s = piece(ch.shield, D.shields);
    const enc = ENCUMBRANCE[ch.movement.encumbrance] || ENCUMBRANCE.Light;
    const maxDexes = [a.maxDex, s.maxDex, enc.maxDex].filter(x => x !== null);
    const armorCat = ['Unarmored', 'Light', 'Medium', 'Heavy'][Math.max(0, Math.min(3, a.weight))];
    const loadCat = LOAD_RANK[ch.movement.encumbrance] > LOAD_RANK[armorCat] ? ch.movement.encumbrance : armorCat;
    d.armor = {
      armor: a, shield: s, armorCat, loadCat,
      maxDex: maxDexes.length ? Math.min(...maxDexes) : null,
      acp: Math.min(a.acp + s.acp, enc.acp),
      asf: a.asf + s.asf,
    };
  }

  function computeDefenses(ch, d, rows) {
    const m = d.mods;
    // Saves
    const saveAbility = { fort: 'con', ref: 'dex', will: 'wis' };
    d.saves = {};
    for (const s of ['fort', 'ref', 'will']) {
      const base = d.baseSaves[s], ability = m[saveAbility[s]];
      const resist = stack(rows, s, t => t === DER);
      const temp = stack(rows, s, t => t !== DER);
      const misc = n(ch.saves[s].misc);
      d.saves[s] = { base, ability, resist, misc, temp, total: base + ability + resist + misc + temp };
    }

    // Armor class
    const armorFx = posNeg(rows, 'ac', 'Armor');
    const armor = Math.max(d.armor.armor.ac, armorFx.pos) + armorFx.neg;
    const shield = d.armor.shield.ac;
    let dex = d.armor.maxDex === null ? m.dex : Math.min(m.dex, d.armor.maxDex);
    if (d.loseDex) dex = Math.min(0, dex);
    const size = d.size.atk;
    const natural = d.effectTotals.nat;
    const deflect = stack(rows, 'ac', t => t === DER);
    const dodgeRaw = stack(rows, 'ac', t => t === 'Dodge (stacks)');
    const dodge = d.loseDex ? Math.min(0, dodgeRaw) : dodgeRaw;
    const temp = stack(rows, 'ac', t => t !== 'Armor' && t !== DER && t !== 'Dodge (stacks)');
    const misc = n(ch.ac.misc);
    d.ac = {
      parts: { armor, shield, dex, size, natural, deflect, dodge, misc, temp },
      total: 10 + armor + shield + dex + size + natural + deflect + dodge + misc + temp,
      flat: 10 + armor + shield + Math.min(dex, 0) + size + natural + deflect + Math.min(dodge, 0) + temp,
      touch: 10 + dex + size + deflect + dodge + temp,
    };
    d.cmd = 10 + d.bab + m.str + dex + d.size.cmb + deflect + dodge + temp;
    d.cmb = d.bab + m.str + d.size.cmb + d.effectTotals.mAtk;

    // Initiative: Dex + misc + numbers in active effect text mentioning "Initiative"
    let initTemp = 0;
    for (const r of rows) if (/initiative/i.test(r.text || '')) initTemp += firstNumber(r.text) || 0;
    d.initiative = { dex: m.dex, misc: n(ch.initiative.misc), temp: initTemp, total: m.dex + n(ch.initiative.misc) + initTemp };
  }

  function skillList(ch) {
    const sys = ch.settings.skillSystem;
    const list = (D.skillLists[sys] || D.skillLists['Standard Skills']).filter(s => !s.endsWith(':'));
    return list;
  }

  function computeSkills(ch, d, rows) {
    const m = d.mods;
    const background = /Background/.test(ch.settings.skillSystem);
    const consolidated = /Consolidated/.test(ch.settings.skillSystem);
    const classSkillSet = new Set();
    for (const c of d.classes) {
      if (!c.data || c.level < 1) continue;
      (c.data.classSkills || D.classSkills[c.name] || []).forEach(s => classSkillSet.add(s));
    }
    const speeds = ch.info.speeds;
    const flyMan = FLIGHT[ch.movement.flight] || 0;

    function tempFor(name) {
      const byType = new Map();
      for (const r of rows) {
        const t = r.type || 'Untyped (stacks)';
        const vals = [];
        if (isNum(r.v && r.v.skills)) vals.push(n(r.v.skills));
        if (r.text && name && r.text.toLowerCase().includes(name.toLowerCase().replace(/:$/, ''))) {
          const fn = firstNumber(r.text);
          if (fn !== null) vals.push(fn);
        }
        if (!vals.length) continue;
        if (!byType.has(t)) byType.set(t, []);
        byType.get(t).push(...vals);
      }
      let total = 0;
      for (const [t, vals] of byType) total += typeTotal(t, vals);
      return total;
    }

    function one(name, entry, label, detail) {
      const meta = D.skillMeta[name] || { ability: 'Int', trained: false, acp: false };
      const abKey = M.ABBR_TO_KEY[meta.ability] || 'int';
      const ranks = n(entry && entry.ranks);
      const misc = n(entry && entry.misc);
      const fromClass = classSkillSet.has(name);
      const isClass = fromClass || !!(entry && entry.classSkill);
      const cls = isClass && ranks > 0 ? 3 : 0;
      let sizeArmor = meta.acp ? d.armor.acp : 0;
      if (name === 'Climb' && isNum(speeds.climb)) sizeArmor += 8;
      if (name === 'Swim' && isNum(speeds.swim)) sizeArmor += 8;
      if (name === 'Fly') sizeArmor += d.size.fly + flyMan;
      if (name === 'Stealth' || name === 'C. Stealth') sizeArmor += d.size.stealth;
      const temp = tempFor(label || name);
      const untrained = meta.trained && ranks < 1;
      const total = ranks + m[abKey] + cls + misc + temp + sizeArmor;
      return {
        name, label: label || name, detail: detail || '', ability: meta.ability, abilityMod: m[abKey], ranks, misc, cls, isClass, fromClass,
        temp, sizeArmor, trained: meta.trained, acp: meta.acp, untrained, total: untrained ? null : total,
        background: background && BACKGROUND_SKILLS.has(name),
      };
    }

    d.skills = skillList(ch).map(name => one(name, ch.skills[name]));
    d.specialty = ch.specialty.map(sp => one(sp.base, sp, sp.base + (sp.detail ? ' ' + sp.detail : ''), sp.detail));

    // Ranks available
    let perLevelTotal = 0;
    for (const c of d.classes) {
      if (!c.data || c.level < 1) continue;
      let per;
      if (consolidated) per = Math.max(1, Math.floor((c.data.skills + m.int) / 2));
      else per = Math.max(1, (ch.settings.minSkillRanks ? Math.max(4, c.data.skills) : c.data.skills) + m.int);
      c.ranksPerLevel = per;
      perLevelTotal += per * c.level;
    }
    const available = perLevelTotal + n(ch.fcb.skills);
    const all = d.skills.concat(d.specialty);
    const totalRanks = all.reduce((a, s) => a + s.ranks, 0);
    const bgRanks = all.filter(s => s.background).reduce((a, s) => a + s.ranks, 0);
    const bgAvail = background ? 2 * d.level : 0;
    d.skillRanks = {
      used: totalRanks - Math.min(bgAvail, bgRanks), available,
      bgUsed: Math.min(bgAvail, bgRanks), bgAvailable: bgAvail, background,
    };
  }

  function computeMovement(ch, d, rows, ctx) {
    const reduce = (s) => {
      const cat = d.armor.loadCat;
      if ((cat === 'Medium' || cat === 'Heavy' || cat === 'Overloaded') && !(ch.movement.ignoreArmor || '').includes(cat === 'Overloaded' ? 'Encumbrance' : cat)) {
        return Math.ceil(s * 2 / 3 / 5) * 5;
      }
      return s;
    };
    const medHeavy = ['Medium', 'Heavy', 'Overloaded'].includes(d.armor.loadCat);
    const mult = multipliers(rows, 'speed');
    const sp = ch.info.speeds;
    const landRaw = (n(sp.base) + stack(rows, 'speed')) * mult;
    const land = reduce(landRaw);
    const bonus = n(ch.movement.chargeBonus);
    const runMult = isNum(ch.movement.runMult) ? n(ch.movement.runMult) : (medHeavy ? 3 : 4);
    d.speed = {
      land, charge: (land + bonus) * 2 * ctx.chargeMult, run: runMult * (land + bonus) * ctx.runMult, modes: {},
    };
    for (const k of ['fly', 'swim', 'burrow', 'climb']) {
      const fx = stack(rows, k);
      if (!isNum(sp[k]) && !fx) { d.speed.modes[k] = null; continue; }
      const s = reduce((n(sp[k]) + fx) * mult);
      d.speed.modes[k] = { move: s, charge: (s + bonus) * 2 * ctx.chargeMult, run: runMult * (s + bonus) * ctx.runMult };
    }
  }

  function computeSpells(ch, d) {
    const sc = ch.spellcasting;
    const cls = d.classes.find(c => c.name && c.name === sc.className && c.data);
    const data = cls ? cls.data : getClass(ch, sc.className);
    const classLevel = Math.min(20, (cls ? cls.level : 0) + n(sc.classLevelMisc));
    const castMod = d.mods[sc.ability] !== undefined ? d.mods[sc.ability] : 0;
    const cl = classLevel + n(sc.clMisc) + d.effectTotals.cl;
    const perDayTable = data ? (data.perDayTable || (data.perDay ? D.spellTables[data.perDay] : null)) : null;
    const knownTable = data ? (data.knownTable || (data.known && D.spellTables[data.known] ? D.spellTables[data.known] : null)) : null;
    const levels = [];
    for (let L = 0; L <= 9; L++) {
      let perDay = null, known = null;
      if (perDayTable && classLevel >= 1) {
        const raw = perDayTable[classLevel - 1][L];
        if (raw === 'inf') perDay = '∞';
        else if (typeof raw === 'number') perDay = raw + (L >= 1 ? Math.max(0, Math.ceil((castMod - L + 1) / 4)) : 0);
      }
      if (knownTable && classLevel >= 1) {
        const raw = knownTable[classLevel - 1][L];
        known = raw === 'inf' ? '∞' : (typeof raw === 'number' ? raw : null);
      }
      const ov = sc.levels[L] && sc.levels[L].perDayOverride;
      const computedPerDay = perDay;
      if (isNum(ov)) perDay = n(ov);
      levels.push({ level: L, perDay, computedPerDay, overridden: isNum(ov), known, dc: 10 + castMod + L });
    }
    d.spells = {
      className: sc.className, data, classLevel, castMod, cl, concentration: cl + castMod, levels,
      asf: d.armor.asf, castingStat: data ? data.stat : null,
    };
  }

  function computeAttacks(ch, d) {
    const m = d.mods, T = d.effectTotals;
    const monk = d.classes.find(c => c.data && /^Monk/.test(c.name));
    const c1 = d.classes[0];
    const v = {
      bab: d.bab, level: d.level, str: m.str, dex: m.dex, con: m.con, int: m.int, wis: m.wis, cha: m.cha,
      sizeAtk: d.size.atk, sizeCmb: d.size.cmb,
      tMeleeAttack: T.mAtk, tMeleeDamage: T.mDmg, tOHDamage: T.ohDmg, t2HDamage: T.thDmg,
      tRangedAttack: T.rAtk, tRangedDamage: T.rDmg,
      cl: d.spells.cl, castMod: d.spells.castMod, class1Level: c1 ? c1.level : 0, class1Bab: c1 ? (c1.bab || 0) : 0,
      twf: T.twf, monkLevel: monk ? monk.level : 0, monkBab: monk ? monk.bab : 0,
      unchainedMonk: d.classes.some(c => c.data && c.name === 'Monk (Unchained)'),
    };
    d.attackVars = v;
    d.weapons = ch.weapons.map(w => attackFor(w, v, T, ch.customAttackOptions || []));
  }

  function attackFor(w, v, T, custom) {
    const out = { attacks: [], damageBonus: null, attackText: '', damageText: '', valid: false };
    if (!w.category || !w.formula) return out;
    const cat = D.attackCategories.find(c => c.name === w.category);
    const opt = cat && (cat.options.find(o => o.label === w.formula) || custom.find(o => o.category === w.category && o.label === w.formula));
    if (!cat || !opt) return out;
    const A = evalExpr(opt.atk, v);
    if (A === null) return out;
    const mwk = w.enh === 'Masterwork' || w.enh === 'Mwk';
    const enhNum = isNum(w.enh) ? n(w.enh) : 0;
    const W = A + n(w.mAtk) + (mwk ? 1 : enhNum);
    const iter = Math.max(1, evalExpr(cat.iter, v) || 1);
    const xm = T.xMelee, xr = T.xRanged, m1 = T.m1st, r1 = T.r1st;
    const it = (base, offs) => { const a = []; for (let i = 1; i < Math.min(iter, 4); i++) a.push(base - offs * i); return a; };
    let atk = [];
    const name = cat.name, label = opt.label;
    if (name === 'Melee Attack') {
      atk = [W + m1]; if (xm > 0) atk.push(W); atk.push(...it(W, 5));
    } else if (name === 'Ranged Attack') {
      // Extra ranged attacks (Rapid Shot, Haste) at full bonus, then iteratives.
      atk = [W + r1].concat(Array(Math.min(2, xr)).fill(W), it(W, 5));
    } else if (name.startsWith('Off-Hand')) {
      atk = [W].concat(it(W, 5));
    } else if (name === 'Combat Maneuver' || name === 'Single Attack') {
      atk = [W + m1];
    } else if (name === 'Magic') {
      atk = [W];
    } else if (name === 'Monk Flurry') {
      const isR = /Ranged/.test(label), isM = /Melee/.test(label);
      if (v.unchainedMonk) {
        atk = [W + m1];
        if (isR) for (let i = 0; i < Math.min(2, xr); i++) atk.push(W);
        if (isM && xm > 0) atk.push(W);
        if (v.monkLevel > 0) atk.push(W);
        if (v.monkLevel > 10) atk.push(W);
        atk.push(...it(W, 5));
      } else {
        const b = W - 2;
        atk = [b + m1];
        if (isR) for (let i = 0; i < Math.min(2, xr); i++) atk.push(b);
        if (isM && xm > 0) atk.push(b);
        if (v.monkLevel > 0) atk.push(b);
        if (iter > 1) atk.push(b - 5);
        if (v.monkLevel > 5) atk.push(b - 5);
        if (iter > 2) atk.push(b - 10);
        if (v.monkLevel > 10) atk.push(b - 10);
        if (v.monkLevel > 15) atk.push(b - 15);
      }
    } else if (name.startsWith('Natural')) {
      const haste = /Haste Applies/.test(label);
      atk = [W + (haste ? m1 : 0)];
      if (haste && xm > 0) atk.push(W);
      const cnt = parseInt((String(w.name).match(/\d+/) || ['1'])[0], 10);
      for (let i = 1; i < Math.min(6, Math.max(1, cnt)); i++) atk.push(W);
    } else if (name === 'Other') {
      if (/Rapid Bomb/.test(label)) atk = [W].concat(Array(Math.min(2, xr)).fill(W), it(W, 5));
      else if (/Kineticist/.test(label) && /Melee/.test(label)) { atk = [W + m1]; if (xm > 0) atk.push(W); atk.push(...it(W, 5)); }
      else if (/Kineticist|Bomb/.test(label)) atk = [W];
      else atk = [W + m1];
    } else {
      atk = [W];
    }
    out.attacks = atk;
    out.attackText = atk.map(sign).join(' / ');
    const dmg = evalExpr(opt.dmg, v);
    if (dmg !== null) {
      out.damageBonus = dmg + enhNum + n(w.mDmg);
      out.damageText = (w.dice ? w.dice + ' ' : '') + (out.damageBonus >= 0 ? '+ ' : '- ') + Math.abs(out.damageBonus);
    }
    if (w.dmgOverride && String(w.dmgOverride).trim()) { out.damageText = String(w.dmgOverride).trim(); out.damageOverride = out.damageText; }
    out.valid = true;
    return out;
  }

  window.PF_ENGINE = { compute, getClass, attackOptions, evalExpr, stack, typeTotal, sign, n, isNum, firstNumber, classByName };
})();
