// Calculation engine: a port of the Pathfinder Autosheet v6.2.1 formulas.
// compute(character) -> derived values. Pure function; never mutates the character.
(function () {
  'use strict';
  const D = window.PF_DATA;
  const M = window.PF_MODEL;
  const { ABILITIES, STACKING_TYPES, SIZES, AGE, XP } = M;

  const classByName = new Map(D.classes.map(c => [c.name, c]));
  const ENH = 'Enhancement', DEFL = 'Deflection', RES = 'Resistance';
  const LEGACY_DER = 'Deflect/Enhance/Resist'; // the Autosheet's combined type; split by what it applies to
  function typeFor(type, key) {
    const t = type || 'Untyped (stacks)';
    if (t !== LEGACY_DER) return t;
    return key === 'ac' ? DEFL : (key === 'fort' || key === 'ref' || key === 'will') ? RES : ENH;
  }
  const BACKGROUND_SKILLS = new Set(['Appraise', 'Artistry:', 'Craft:', 'Handle Animal', 'Kn. Engineering', 'Kn. Geography',
    'Kn. History', 'Kn. Nobility', 'Linguistics', 'Lore:', 'Perform:', 'Prof:', 'Sleight of Hand']);
  const FLIGHT = { Clumsy: -8, Poor: -4, Average: 0, Good: 4, Perfect: 8 };
  const LOAD_RANK = { Unarmored: 0, Light: 1, Medium: 2, Heavy: 3, Overloaded: 4 };

  // ---- Condition fixes on top of the spreadsheet's table (data.js is generated, so they live here).
  // Core Rulebook: Stunned loses Dex to AC; Grappled takes -2 on attacks (and so CMB) and can't move.
  // (The table already stops running and charging for Fatigued, Exhausted, Entangled, Grappled and Nauseated.)
  // Plus conditions the spreadsheet didn't list.
  (function fixConditions() {
    const C = D.conditions, byName = nm => C.find(c => c.name === nm);
    const set = (nm, fields) => { const c = byName(nm); if (c) Object.assign(c, fields); };
    set('Stunned', { ac: 'LOSEDEX-2' });
    set('Grappled', { mAtk: -2, rAtk: -2, speedMult: 0 });   // (CMB already takes melee attack penalties)
    const add = c => { if (!byName(c.name)) C.splice(C.findIndex(x => /Encumbrance|Overencumbered/.test(x.name)), 0, c); };
    add({ name: 'Flat-Footed', ac: 'LOSEDEX' });                 // no Dex (or dodge) bonus to AC or CMD
    add({ name: 'Helpless', dex: -999, ac: 'LOSEDEX' });         // Dex 0; melee attackers get +4, coup de grace
    add({ name: 'Unconscious', dex: -999, ac: 'LOSEDEX', speedMult: 0, chargeMult: 0, runMult: 0 });   // helpless
  })();
  // Encumbrance picked as a condition sets the load (the heavier of it and your gear's or Combat tab's load)
  const ENC_CONDITIONS = { 'Light Encumbrance': 'Light', 'Medium Encumbrance': 'Medium', 'Heavy Encumbrance': 'Heavy', 'Overencumbered': 'Overloaded' };
  // Carrying capacity (Core Rulebook Table 7-4): heavy load by Strength score 0-29; +10 Str multiplies by 4.
  const HEAVY_LOAD = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 115, 130, 150, 175, 200, 230, 260, 300, 350, 400, 460, 520, 600, 700, 800, 920, 1040, 1200, 1400];
  // Size multipliers [bipeds, quadrupeds].
  const SIZE_CARRY = { Fine: [1 / 8, 1 / 4], Diminutive: [1 / 4, 1 / 2], Tiny: [1 / 2, 3 / 4], Small: [3 / 4, 1], Medium: [1, 1.5], Large: [2, 3], Huge: [4, 6], Gargantuan: [8, 12], Colossal: [16, 24] };
  // Weights (lb.) of the sheet's armor and shields for Medium characters, from the Core Rulebook, Ultimate Combat and Ultimate Equipment.
  const ARMOR_WEIGHT = {
    'Mage Armor (Spell)': 0, 'Bracers of Armor (Wondrous Item)': 1, 'Clothing': 0, 'Haramaki': 1, 'Padded Cloth': 10, 'Quilted Cloth': 15,
    'Silken Ceremonial Armor': 4, 'Lamellar Cuirass': 8, 'Leather': 15, 'Parade Armor': 20, 'Studded Leather': 20, 'Wooden': 25, 'Chain Shirt': 25,
    'Leather Lamellar': 25, 'Armored Coat': 20, 'Hide': 25, 'Do-Maru': 30, 'Horn Lamellar': 30, 'Kikko Armor': 25, 'Scale Mail': 30,
    'Agile Breastplate': 25, 'Breastplate': 30, 'Chainmail': 40, 'Four-Mirror Armor': 45, 'Mountain Pattern Armor': 40, 'Steel Lamellar': 35,
    'Banded Mail': 35, 'Iron Lamellar': 50, 'Kusari Gusoku': 45, 'Splint Mail': 45, 'Tatami-Do': 45, 'Agile Half-Plate': 55, 'Half-Plate': 50,
    'O-Yoroi': 45, 'Stone Coat': 45, 'Full Plate': 50,
  };
  const SHIELD_WEIGHT = { 'Buckler': 5, 'Klar': 6, 'Madu': 5, 'Light Shield': 6, 'Heavy Shield': 15, '(Spell) Shield': 0, 'Tower Shield': 45 };
  function heavyLoad(str) {
    if (str <= 0) return 0;
    let mult = 1;
    while (str > 29) { str -= 10; mult *= 4; }
    return HEAVY_LOAD[Math.floor(str)] * mult;
  }
  // Default weight of a worn armor or shield: from the table, halved for mithral (and darkwood shields).
  function armorDefaultWeight(p, kind) {
    if (!p || !p.item) return 0;
    const base = (kind === 'shield' ? SHIELD_WEIGHT : ARMOR_WEIGHT)[p.item];
    if (base === undefined) return null;
    const half = /mithral/i.test(p.material || '') || (kind === 'shield' && /darkwood/i.test(p.material || ''));
    return half ? base / 2 : base;
  }
  const round2 = x => Math.round(x * 100) / 100;
  function computeGear(ch, d) {
    const c = ch.carry || {};
    const str = d.abilities.str.score + n(c.strBonus);
    const sz = SIZE_CARRY[d.size.name] || SIZE_CARRY.Medium;
    const mult = (isNum(c.mult) && n(c.mult) > 0 ? n(c.mult) : 1) * sz[c.quadruped ? 1 : 0];
    const heavy = Math.floor(heavyLoad(str) * mult);
    const light = Math.floor(heavy / 3), medium = Math.floor(heavy * 2 / 3);
    const qty = x => (x.qty === '' || x.qty === undefined || x.qty === null ? 1 : n(x.qty));
    let items = 0, value = 0;
    for (const x of ch.inventory || []) {
      value += qty(x) * n(x.value);
      if (x.carried !== false) items += qty(x) * n(x.weight);
    }
    let magic = 0;
    for (const x of ch.miscItems || []) {
      value += qty(x) * n(x.value);
      if (x.carried !== false) magic += qty(x) * n(x.weight);
    }
    const weapons = (ch.weapons || []).reduce((t, w) => t + (w.carried === false ? 0 : n(w.weight)), 0);
    const wt = (p, kind) => (isNum(p.weight) ? n(p.weight) : (armorDefaultWeight(p, kind) || 0));
    const armor = wt(ch.armor || {}, 'armor'), shield = wt(ch.shield || {}, 'shield');
    const m = ch.money || {};
    const coinCount = n(m.pp) + n(m.gp) + n(m.sp) + n(m.cp);
    const coins = c.coins === false ? 0 : coinCount / 50;
    const total = round2(items + magic + weapons + armor + shield + coins);
    const load = total <= light ? 'Light' : total <= medium ? 'Medium' : total <= heavy ? 'Heavy' : 'Overloaded';
    const money = n(m.pp) * 10 + n(m.gp) + n(m.sp) / 10 + n(m.cp) / 100;
    d.gear = {
      str, light, medium, heavy, liftOverHead: heavy, liftOffGround: heavy * 2, push: heavy * 5,
      items: round2(items), magic: round2(magic), weapons: round2(weapons), armor: round2(armor), shield: round2(shield), coins: round2(coins), total, load,
      armorDefault: armorDefaultWeight(ch.armor, 'armor'), shieldDefault: armorDefaultWeight(ch.shield, 'shield'),
      money: round2(money), itemValue: round2(value), wealth: round2(money + value),
    };
  }
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
      const t = typeFor(r.type, key);
      if (typeFilter && !typeFilter(t)) continue;
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

  // ---------- Bonus formulas ----------
  // A bonus value is a number or a small formula such as "max(3, level)" or "ranks >= 10 ? 6 : 3".
  // Variables: level, bab, str..cha (modifiers), ranks (in the targeted skill), class1..class3 (levels in each
  // class slot) and any class name as a word, e.g. rogue, cleric, machine_smith (your levels in it; 0 if none).
  const BASE_VARS = new Set(['level', 'bab', 'cl', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'ranks', 'speed', 'fly', 'swim', 'burrow', 'climb']);
  const MATH_FNS = new Set(['max', 'min', 'floor', 'ceil', 'abs']);
  function classSlug(name) { return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
  const CLASS_SLUGS = new Set(D.classes.map(c => classSlug(c.name)).concat(['class1', 'class2', 'class3']));
  const formulaCache = new Map();
  // Returns { fn, unknown } or null. `unknown` lists words that must be one of this character's class names.
  function compileFormula(src) {
    const key = String(src).toLowerCase();
    if (formulaCache.has(key)) return formulaCache.get(key);
    let out = null;
    if (/^[\d\s+\-*/().,<>=?:!&|a-z_]*$/.test(key)) {
      const unknown = [];
      const body = key.replace(/[a-z_][a-z0-9_]*/g, id => {
        if (BASE_VARS.has(id) || MATH_FNS.has(id)) return id;
        if (!CLASS_SLUGS.has(id)) unknown.push(id);
        return 'L("' + id + '")';
      });
      try {
        const fn = new Function('V', 'const {level=0,bab=0,cl=0,str=0,dex=0,con=0,int=0,wis=0,cha=0,ranks=0,speed=0,fly=0,swim=0,burrow=0,climb=0}=V; const {max,min,floor,ceil,abs}=Math;' +
          ' const C=V.C||{}; const L=k=>Object.prototype.hasOwnProperty.call(C,k)?C[k]:0; return (' + body + ');');
        out = { fn, unknown };
      } catch (e) { out = null; }
    }
    formulaCache.set(key, out);
    return out;
  }
  function evalBonus(value, V) {
    if (value === '' || value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const t = String(value).trim();
    if (/^[-+]?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
    const c = compileFormula(t);
    if (!c) return null;
    const C = (V && V.C) || {};
    if (c.unknown.some(id => !Object.prototype.hasOwnProperty.call(C, id))) return null;
    try { const r = Number(c.fn(V || {})); return Number.isFinite(r) ? Math.floor(r) : null; } catch (e) { return null; }
  }
  function isValidBonus(value, V) { return value === '' || value === null || value === undefined || evalBonus(value, V || {}) !== null; }

  function pushBonuses(rows, list, src, nameFn, defType, V, fixedType) {
    for (const b of list) {
      if (!b || b.active === false || !b.target || b.target === 'note') continue;
      const type = fixedType ? defType : (b.type || defType);
      const name = nameFn(b);
      if (b.target === 'skill') {
        if (b.skill) rows.push({ src, name, type, v: {}, text: '', skill: b.skill, formula: b.value });
        continue;
      }
      const x = evalBonus(b.value, V);
      if (x === null) continue;
      const v = {}, row = { src, name, type, v, text: '' };
      if (b.target === 'saves') Object.assign(v, { fort: x, ref: x, will: x });
      else if (b.target === 'atk') Object.assign(v, { mAtk: x, rAtk: x });
      else if (b.target === 'dmg') Object.assign(v, { mDmg: x, rDmg: x });
      else if (b.target === 'weapon' || b.target === 'weaponDmg') {
        if (!String(b.weapon || '').trim()) continue;
        row.weapon = String(b.weapon).trim();
        v[b.target === 'weapon' ? 'wAtk' : 'wDmg'] = x;
      } else v[b.target] = x;
      rows.push(row);
    }
  }
  // Base speeds, for effect formulas such as Haste's min(30, speed)
  function speedVars(ch) {
    const sp = (ch.info && ch.info.speeds) || {};
    return { speed: n(sp.base), fly: n(sp.fly), swim: n(sp.swim), burrow: n(sp.burrow), climb: n(sp.climb) };
  }
  function abilityVars(d, level, bab) {
    const V = { level, bab, cl: d.quickCl || 0, C: classVars(d) };
    for (const a of ABILITIES) V[a] = d.mods ? d.mods[a] : 0;
    return V;
  }
  // class1..class3 = level in each class slot; each class name = total levels in that class
  function classVars(d) {
    const C = { class1: 0, class2: 0, class3: 0 };
    (d.classes || []).forEach((c, i) => {
      const lv = c.data ? c.level : 0;
      if (i < 3) C['class' + (i + 1)] = lv;
      const slug = classSlug(c.name);
      if (slug) C[slug] = (C[slug] || 0) + lv;
    });
    return C;
  }

  // ---------- Effect rows ----------
  function buildEffectRows(ch, ctx) {
    const rows = [];
    const V = Object.assign({}, ctx.vars || {}, speedVars(ch));
    // Effect and toggle cells can hold formulas (e.g. 1 + floor(slayer/5)); "x2"-style multipliers stay as text.
    const evalV = v => {
      const out = {};
      for (const [k, x] of Object.entries(v || {})) {
        if (typeof x === 'string' && !/^\s*x/i.test(x) && !/^\s*[-+]?\d+(\.\d+)?\s*$/.test(x)) {
          const r = evalBonus(x, V);
          if (r !== null) out[k] = r;
        } else out[k] = x;
      }
      return out;
    };
    for (const e of ch.effects) if (e.active) rows.push({ src: 'effect', name: e.name, type: e.type, v: evalV(e.v), text: e.text || '' });
    // Bonuses attached to race, traits, feats and class features
    // Effects can also carry bonuses (e.g. created by casting a buff spell)
    for (const e of ch.effects) if (e.active && e.bonuses && e.bonuses.length) pushBonuses(rows, e.bonuses, 'effect', b => b.label || e.name || 'Effect', 'Untyped (stacks)', V);
    pushBonuses(rows, (ch.race && ch.race.bonuses) || [], 'race', b => b.label || 'Racial bonus', 'Racial', V, true);
    for (const t of ch.traits || []) pushBonuses(rows, t.bonuses || [], 'trait', b => b.label || String(t.text || 'Trait').split(':')[0], 'Trait', V);
    for (const f of ch.feats || []) pushBonuses(rows, f.bonuses || [], 'feat', b => b.label || f.name || 'Feat', 'Untyped (stacks)', V);
    for (const f of ch.classFeatures || []) pushBonuses(rows, f.bonuses || [], 'feature', b => b.label || f.name || 'Class feature', 'Untyped (stacks)', V);
    for (const s of ch.slots || []) pushBonuses(rows, s.bonuses || [], 'worn', b => b.label || s.item || s.slot || 'Worn item', 'Enhancement', V);
    for (const x of ch.miscItems || []) pushBonuses(rows, x.bonuses || [], 'misc', b => b.label || x.name || 'Magic item', 'Enhancement', V);


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
      for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha', 'fort', 'ref', 'will', 'mAtk', 'mDmg', 'rAtk', 'rDmg', 'skills', 'cl', 'cmb']) {
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
    // Bonus formulas can use ability modifiers, so estimate them first, then refine.
    d.mods = null;
    // Caster level for formulas (before effects; the CL column of effects is added later for spells)
    { const sc = ch.spellcasting || {}; const cc = d.classes.find(x => x.data && x.name === sc.className);
      d.quickCl = Math.min(20, (cc ? cc.level : 0) + n(sc.classLevelMisc)) + n(sc.clMisc); }
    ctx.vars = abilityVars({ mods: quickMods(ch), quickCl: d.quickCl, classes: d.classes }, d.level, d.bab);
    let rows = buildEffectRows(ch, Object.assign({}, ctx, { hpMax: 0 }));
    computeAbilities(ch, d, rows);
    ctx.vars = abilityVars(d, d.level, d.bab);
    rows = buildEffectRows(ch, Object.assign({}, ctx, { hpMax: 0 }));
    computeAbilities(ch, d, rows);
    ctx.vars = abilityVars(d, d.level, d.bab);
    computeHp(ch, d, rows);
    ctx.hpMax = d.hp.max; ctx.hpCurrent = d.hp.current;
    rows = buildEffectRows(ch, ctx);
    computeAbilities(ch, d, rows);  // wound thresholds don't touch abilities, but recompute for consistency
    d.formulaVars = Object.assign({}, ctx.vars, speedVars(ch));
    d.overlaps = findOverlaps(rows);
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

    computeGear(ch, d);
    computeArmor(ch, d);
    computeDefenses(ch, d, rows);
    computeSkills(ch, d, rows);
    computeMovement(ch, d, rows, ctx);
    computeSpells(ch, d);
    computeAttacks(ch, d);
    d.companions = window.PF_COMPANION ? (ch.companions || []).map(c => window.PF_COMPANION.compute(c, d)) : [];
    return d;
  }

  // Rough ability modifiers before effects are known (used only to seed bonus formulas).
  function quickMods(ch) {
    const out = {};
    const ageIdx = Math.max(0, AGE.categories.indexOf(ch.info.age));
    const r = ch.race || {};
    for (const a of ABILITIES) {
      const ab = ch.abilities[a];
      const race = n(r.abilityMods && r.abilityMods[a]) + (r.flex && r.flexAbility === a ? 2 : 0);
      out[a] = mod(n(ab.base) + race + n(ab.enh) + n(ab.inh) - Math.abs(n(ab.pen)) + AGE.mods[a][ageIdx]);
    }
    return out;
  }

  // Bonuses of the same (non-stacking) type to the same thing from different sources: only the highest counts.
  const KEY_LABELS = { ac: 'AC', nat: 'natural armor', fort: 'Fort', ref: 'Ref', will: 'Will', str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha',
    mAtk: 'melee attack', mDmg: 'melee damage', rAtk: 'ranged attack', rDmg: 'ranged damage', cl: 'caster level', skills: 'all skills',
    speed: 'speed', hp: 'max HP', init: 'initiative', cmb: 'CMB', cmd: 'CMD', wAtk: 'weapon attack', wDmg: 'weapon damage' };
  function findOverlaps(rows) {
    const groups = new Map();
    const keys = new Set();
    rows.forEach(r => Object.keys(r.v || {}).forEach(k => keys.add(k)));
    for (const key of keys) {
      if (!KEY_LABELS[key]) continue;
      const byType = new Map();
      for (const r of rows) {
        const raw = r.v && r.v[key];
        if (!isNum(raw) || n(raw) <= 0) continue;
        const t = typeFor(r.type, key);
        if (STACKING_TYPES.includes(t)) continue;
        const id = key === 'wAtk' || key === 'wDmg' ? t + '|' + r.weapon : t;
        if (!byType.has(id)) byType.set(id, []);
        byType.get(id).push({ name: r.name, val: n(raw), type: t });
      }
      for (const list of byType.values()) {
        const names = [...new Set(list.map(x => x.name))];
        if (names.length < 2) continue;
        const best = Math.max(...list.map(x => x.val));
        const gid = list[0].type + '|' + names.slice().sort().join('|') + '|' + best;
        if (!groups.has(gid)) groups.set(gid, { type: list[0].type, names, best, keys: [] });
        groups.get(gid).keys.push(KEY_LABELS[key]);
      }
    }
    return [...groups.values()];
  }

  function computeAbilities(ch, d, rows) {
    d.abilities = {};
    const ageIdx = Math.max(0, AGE.categories.indexOf(ch.info.age));
    for (const a of ABILITIES) {
      const ab = ch.abilities[a];
      // Enhancement from effects doesn't stack with the Enhance column; only the excess counts.
      const fx = posNeg(rows, a, ENH);
      const others = stack(rows, a, t => t !== ENH);
      const enh = n(ab.enh);
      const temp = Math.max(0, fx.pos - enh) + fx.neg + others;
      const age = AGE.mods[a][ageIdx];
      const r = ch.race || {};
      const race = n(r.abilityMods && r.abilityMods[a]) + (r.flex && r.flexAbility === a ? 2 : 0);
      const score = Math.max(0, n(ab.base) + race + enh + n(ab.inh) + temp - Math.abs(n(ab.pen)) + age);
      d.abilities[a] = { score, mod: mod(score), temp, age, race };
    }
    d.mods = {};
    for (const a of ABILITIES) d.mods[a] = d.abilities[a].mod;
  }

  function computeHp(ch, d, rows) {
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
    const bonus = rows ? stack(rows, 'hp') : 0;   // e.g. Toughness
    const max = Math.floor(total) + n(ch.fcb.hp) + bonus - 5 * nl;
    const current = max - Math.abs(n(ch.hp.damage)) + n(ch.hp.temp) - n(ch.hp.nonlethal);
    d.hp = { max, current, base: Math.floor(total) + n(ch.fcb.hp), bonus };
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
      const base = (it ? it.ac : 0) + (mat ? mat.ac : 0);
      const ac = enhNum + base;
      const acp = it ? Math.min(0, -it.acp + (mat ? mat.acp : 0) + n(p.mSkill) + (mwk ? 1 : 0)) : Math.min(0, n(p.mSkill));
      const maxDex = it && isNum(it.maxDex) ? it.maxDex + (mat ? mat.maxDex : 0) + n(p.mDex) : null;
      const asf = it ? Math.max(0, it.asf + (mat ? mat.asf : 0)) : 0;
      const weight = it && it.type in LOAD_RANK && table === D.armor ? LOAD_RANK[it.type] + (mat ? mat.weight : 0) : 0;
      return { ac, base, enh: enhNum, acp, maxDex, asf, weight, note: mat && mat.note ? mat.note : '' };
    }
    const a = piece(ch.armor, D.armor), s = piece(ch.shield, D.shields);
    // "Auto" takes the load from what you carry (inventory, weapons, armor, coins).
    let encName = ch.movement.encumbrance === 'Auto' ? (d.gear ? d.gear.load : 'Light') : (ch.movement.encumbrance || 'Light');
    for (const cn of ch.conditions || []) { const L = ENC_CONDITIONS[cn]; if (L && (LOAD_RANK[L] || 0) > (LOAD_RANK[encName] || 0)) encName = L; }
    const enc = ENCUMBRANCE[encName] || ENCUMBRANCE.Light;
    const maxDexes = [a.maxDex, s.maxDex, enc.maxDex].filter(x => x !== null);
    const armorCat = ['Unarmored', 'Light', 'Medium', 'Heavy'][Math.max(0, Math.min(3, a.weight))];
    const loadCat = LOAD_RANK[encName] > LOAD_RANK[armorCat] ? encName : armorCat;
    d.armor = {
      armor: a, shield: s, armorCat, loadCat, encumbrance: encName,
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
      const resist = stack(rows, s, t => t === RES);
      const temp = stack(rows, s, t => t !== RES);
      const misc = n(ch.saves[s].misc);
      d.saves[s] = { base, ability, resist, misc, temp, total: base + ability + resist + misc + temp };
    }

    // Armor class
    // Armor: an Enhancement effect on AC (e.g. Magic Vestment) replaces the armor's own enhancement if higher;
    // an Armor-type effect (e.g. Mage Armor) replaces the whole armor bonus if higher.
    const armorFx = posNeg(rows, 'ac', 'Armor');
    const enhFx = posNeg(rows, 'ac', ENH);
    const worn = d.armor.armor.base + Math.max(d.armor.armor.enh, enhFx.pos);
    const armor = Math.max(worn, armorFx.pos) + armorFx.neg + enhFx.neg;
    const shield = d.armor.shield.ac;
    let dex = d.armor.maxDex === null ? m.dex : Math.min(m.dex, d.armor.maxDex);
    if (d.loseDex) dex = Math.min(0, dex);
    const size = d.size.atk;
    const natural = d.effectTotals.nat;
    const deflect = stack(rows, 'ac', t => t === DEFL);
    const dodgeRaw = stack(rows, 'ac', t => t === 'Dodge (stacks)');
    const dodge = d.loseDex ? Math.min(0, dodgeRaw) : dodgeRaw;
    const temp = stack(rows, 'ac', t => t !== 'Armor' && t !== ENH && t !== DEFL && t !== 'Dodge (stacks)');
    const misc = n(ch.ac.misc);
    d.ac = {
      parts: { armor, shield, dex, size, natural, deflect, dodge, misc, temp },
      total: 10 + armor + shield + dex + size + natural + deflect + dodge + misc + temp,
      flat: 10 + armor + shield + Math.min(dex, 0) + size + natural + deflect + Math.min(dodge, 0) + temp,
      touch: 10 + dex + size + deflect + dodge + temp,
    };
    d.cmd = 10 + d.bab + m.str + dex + d.size.cmb + deflect + dodge + temp + stack(rows, 'cmd');
    d.cmb = d.bab + m.str + d.size.cmb + d.effectTotals.mAtk + stack(rows, 'cmb');

    // Initiative: Dex + misc + numbers in active effect text mentioning "Initiative"
    let initTemp = 0;
    for (const r of rows) if (/initiative/i.test(r.text || '')) initTemp += firstNumber(r.text) || 0;
    initTemp += stack(rows, 'init');
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

    const skillKey = s => String(s || '').replace(/:$/, '').trim().toLowerCase();
    function tempFor(name, label, ranks) {
      const byType = new Map();
      for (const r of rows) {
        const t = typeFor(r.type, 'skills');
        const vals = [];
        if (r.skill) {
          if (skillKey(r.skill) === skillKey(name)) {
            const x = evalBonus(r.formula, Object.assign({}, d.formulaVars, { ranks }));
            if (x !== null) vals.push(x);
          }
          if (!vals.length) continue;
        }
        if (isNum(r.v && r.v.skills)) vals.push(n(r.v.skills));
        const textName = label || name;
        if (r.text && textName && r.text.toLowerCase().includes(textName.toLowerCase().replace(/:$/, ''))) {
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
      const temp = tempFor(name, label, ranks);
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
    const raceRanks = n(ch.race && ch.race.skillRanksPerLevel) * d.level;
    const available = perLevelTotal + n(ch.fcb.skills) + raceRanks;
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
    // Running: x4, or x3 in heavy armor or with a heavy load (Core Rulebook)
    const heavy = ['Heavy', 'Overloaded'].includes(d.armor.loadCat);
    // Over your heavy load you can only move 5 feet, as a full-round action (Slow and Steady doesn't help here)
    const overloaded = d.armor.loadCat === 'Overloaded' && !(ch.movement.ignoreArmor || '').includes('Encumbrance');
    const mult = multipliers(rows, 'speed');
    const sp = ch.info.speeds;
    const landRaw = (n(sp.base) + stack(rows, 'speed')) * mult;
    const cap = s => (overloaded ? Math.min(s, 5) : s);
    const land = cap(reduce(landRaw));
    const bonus = n(ch.movement.chargeBonus);
    const runMult = isNum(ch.movement.runMult) ? n(ch.movement.runMult) : (heavy ? 3 : 4);
    const move = s => ({ charge: overloaded || !s ? 0 : (s + bonus) * 2 * ctx.chargeMult, run: overloaded || !s ? 0 : runMult * (s + bonus) * ctx.runMult });
    d.speed = Object.assign({ land, modes: {}, overloaded }, move(land));
    for (const k of ['fly', 'swim', 'burrow', 'climb']) {
      const fx = stack(rows, k);
      if (!isNum(sp[k]) && !fx) { d.speed.modes[k] = null; continue; }
      const s = cap(reduce((n(sp[k]) + fx) * mult));
      d.speed.modes[k] = Object.assign({ move: s }, move(s));
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
    const wRows = d.rows.filter(r => r.weapon);
    d.weapons = ch.weapons.map(w => attackFor(w, v, T, ch.customAttackOptions || [], wRows));
  }

  function defaultDamageExpr(category) {
    if (/^Off-Hand Ranged/.test(category) || /^Ranged/.test(category)) return 'v.tRangedDamage';
    if (/^Off-Hand Melee/.test(category)) return 'v.tMeleeDamage+v.tOHDamage';
    if (/^(Melee|Natural|Monk|Single)/.test(category)) return 'v.tMeleeDamage';
    return '0';
  }

  function attackFor(w, v, T, custom, wRows) {
    const out = { attacks: [], damageBonus: null, attackText: '', damageText: '', valid: false };
    if (!w.category || !w.formula) return out;
    const cat = D.attackCategories.find(c => c.name === w.category);
    const opt = cat && (cat.options.find(o => o.label === w.formula) || custom.find(o => o.category === w.category && o.label === w.formula));
    if (!cat || !opt) return out;
    const A = evalExpr(opt.atk, v);
    if (A === null) return out;
    const mwk = w.enh === 'Masterwork' || w.enh === 'Mwk';
    const enhNum = isNum(w.enh) ? n(w.enh) : 0;
    // Weapon Focus / Specialization style bonuses: match the weapon by name
    const mine = (wRows || []).filter(r => String(w.name || '').toLowerCase().includes(r.weapon.toLowerCase()));
    const wAtk = stack(mine, 'wAtk'), wDmg = stack(mine, 'wDmg');
    const W = A + n(w.mAtk) + (mwk ? 1 : enhNum) + wAtk;
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
    // A custom formula copied from a spreadsheet with a blank damage part still gets the usual damage
    // bonuses for its attack type (Deadly Aim, Power Attack, buffs...).
    const isCustom = !cat.options.includes(opt);
    const blankDmg = opt.dmg === null || opt.dmg === undefined ? false : !String(opt.dmg).trim() || String(opt.dmg).trim() === '0';
    const dmg = evalExpr(isCustom && blankDmg ? defaultDamageExpr(cat.name) : opt.dmg, v);
    if (dmg !== null) {
      out.damageBonus = dmg + enhNum + n(w.mDmg) + wDmg;
      out.damageText = (w.dice ? w.dice + ' ' : '') + (out.damageBonus >= 0 ? '+ ' : '- ') + Math.abs(out.damageBonus);
    }
    if (w.dmgOverride && String(w.dmgOverride).trim()) { out.damageText = String(w.dmgOverride).trim(); out.damageOverride = out.damageText; }
    out.valid = true;
    return out;
  }

  window.PF_ENGINE = { compute, heavyLoad, armorDefaultWeight, evalBonus, isValidBonus, classSlug, pushBonuses, posNeg, findOverlaps, getClass, attackOptions, evalExpr, stack, typeTotal, sign, n, isNum, firstNumber, classByName };
})();
