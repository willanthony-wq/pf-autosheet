// Validates an audit output file against its input: one entry per id in order, rule schema, and every formula
// evaluates to a finite number for a range of test characters. Usage: node check.js out/partNN.json in/partNN.jsonl
const fs = require('fs');
const [outFile, inFile] = process.argv.slice(2);
const errors = [];
let out;
try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch (e) { console.log('ERROR output is not valid JSON: ' + e.message); process.exit(1); }
const input = fs.readFileSync(inFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
if (!Array.isArray(out)) { console.log('ERROR output must be a JSON array'); process.exit(1); }
if (out.length !== input.length) errors.push(`expected ${input.length} entries, got ${out.length}`);
const TARGETS = new Set('str dex con int wis cha skill skills saves fort ref will ac nat cmd hp init atk mAtk rAtk dmg mDmg rDmg cmb cl speed note'.split(' '));
const TYPES = new Set(['Alchemical', 'Armor', 'Circumstance (stacks)', 'Competence', 'Deflection', 'Dodge (stacks)', 'Enhancement', 'Insight', 'Luck', 'Morale', 'Precision Damage', 'Racial', 'Resistance', 'Sacred / Profane', 'Size', 'Trait', 'Untyped (stacks)', 'Inherent', 'Natural Armor', 'Shield']);
const SKILLS = new Set(['Acrobatics', 'Appraise', 'Bluff', 'Climb', 'Diplomacy', 'Disable Device', 'Disguise', 'Escape Artist', 'Fly', 'Handle Animal', 'Heal', 'Intimidate', 'Kn. Arcana', 'Kn. Dungeoneering', 'Kn. Engineering', 'Kn. Geography', 'Kn. History', 'Kn. Local', 'Kn. Nature', 'Kn. Nobility', 'Kn. Planes', 'Kn. Religion', 'Linguistics', 'Perception', 'Ride', 'Sense Motive', 'Sleight of Hand', 'Spellcraft', 'Stealth', 'Survival', 'Swim', 'Use Magic Device']);
const BASE = new Set(['cls', 'level', 'bab', 'cl', 'tier', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'max', 'min', 'floor', 'ceil', 'abs']);
function formula(f, where) {
  if (typeof f === 'number') return;
  if (typeof f !== 'string' || !f.trim()) { errors.push(`${where}: formula must be a number or a non-empty string`); return; }
  if (/[^\w\s+\-*/().,?:<>=!&|]/.test(f)) { errors.push(`${where}: unexpected character in "${f}"`); return; }
  const ids = (f.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).filter(x => !BASE.has(x));
  for (const id of ids) if (!/^[a-z][a-z0-9_]*$/.test(id)) errors.push(`${where}: unknown name "${id}" in "${f}"`);
  for (const s of [{ cls: 1, level: 1, bab: 0, cl: 1, tier: 1, m: -1 }, { cls: 5, level: 7, bab: 5, cl: 5, tier: 3, m: 2 }, { cls: 20, level: 20, bab: 20, cl: 20, tier: 10, m: 5 }]) {
    const vars = { cls: s.cls, level: s.level, bab: s.bab, cl: s.cl, tier: s.tier, str: s.m, dex: s.m, con: s.m, int: s.m, wis: s.m, cha: s.m };
    for (const id of ids) vars[id] = s.cls;
    try {
      const fn = new Function(...Object.keys(vars), 'max', 'min', 'floor', 'ceil', 'abs', `return (${f});`);
      const v = fn(...Object.values(vars), Math.max, Math.min, Math.floor, Math.ceil, Math.abs);
      if (typeof v !== 'number' || !isFinite(v)) errors.push(`${where}: "${f}" gives ${v}`);
    } catch (e) { errors.push(`${where}: "${f}" does not evaluate (${e.message})`); return; }
  }
}
out.forEach((o, i) => {
  const want = input[i] && input[i].id;
  if (!o || o.id !== want) { errors.push(`entry ${i}: id ${o && o.id} should be ${want}`); return; }
  const r = o.rule, at = `${o.id} ${input[i].name}`;
  if (r === null) return;
  if (typeof r !== 'object') { errors.push(`${at}: rule must be null or an object`); return; }
  const keys = Object.keys(r).filter(k => !['uses', 'roll', 'cost', 'bonuses', 'note', 'dc'].includes(k));
  if (keys.length) errors.push(`${at}: unknown fields ${keys.join(', ')}`);
  if (!r.uses && !r.roll && !r.cost && !(r.bonuses && r.bonuses.length) && !r.note && r.dc === undefined) errors.push(`${at}: empty rule (use null)`);
  if (r.dc !== undefined) formula(r.dc, at + ' dc');
  if (r.uses) {
    formula(r.uses.max, at + ' uses.max');
    if (!['uses', 'rounds', 'minutes', 'hours', 'points'].includes(r.uses.unit)) errors.push(`${at}: uses.unit "${r.uses.unit}"`);
    if (!['day', 'week'].includes(r.uses.per)) errors.push(`${at}: uses.per "${r.uses.per}"`);
    if (r.uses.extra && !(Array.isArray(r.uses.extra) && r.uses.extra.every(e => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number'))) errors.push(`${at}: uses.extra must be [["Feat name", number]]`);
  }
  if (r.roll) {
    formula(r.roll.count, at + ' roll.count');
    if (![2, 3, 4, 6, 8, 10, 12, 20].includes(r.roll.die)) errors.push(`${at}: roll.die "${r.roll.die}"`);
    if (r.roll.bonus !== undefined) formula(r.roll.bonus, at + ' roll.bonus');
    if (r.roll.dc !== undefined) formula(r.roll.dc, at + ' roll.dc');
  }
  if (r.cost && !(typeof r.cost.from === 'string' && r.cost.from && typeof r.cost.n === 'number')) errors.push(`${at}: cost must be { from: "name", n: number }`);
  for (const [k, b] of (r.bonuses || []).entries()) {
    const w = `${at} bonus ${k}`;
    if (!TARGETS.has(b.target)) errors.push(`${w}: target "${b.target}"`);
    if (b.target === 'skill' && !SKILLS.has(b.skill)) errors.push(`${w}: skill "${b.skill}"`);
    if (b.target !== 'note') formula(b.value, w + ' value');
    if (b.type !== undefined && !TYPES.has(b.type)) errors.push(`${w}: type "${b.type}"`);
    if (typeof b.situational !== 'boolean') errors.push(`${w}: situational must be true or false`);
  }
});
if (errors.length) { console.log(errors.slice(0, 60).join('\n') + (errors.length > 60 ? `\n... ${errors.length - 60} more` : '')); process.exit(1); }
const rules = out.filter(o => o.rule).length;
console.log(`OK ${out.length} entries, ${rules} rules, ${out.length - rules} null`);
