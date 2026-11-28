// Builds data/rules/features.json from the class-feature audit (tools/rules-audit/).
//   node tools/build_rules.js
// The audit lists every class feature, archetype ability, class choice (and its powers and picks), mythic ability,
// per-day feat and per-day racial trait in the rules data (rules-audit/items.jsonl, made by prep.js), and one
// decision per item (rules-audit/decisions/*.json and auto-null.json): null, or what the sheet needs
// (uses counter, roll, cost, bonuses). Every item must have exactly one decision.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), AUD = path.join(__dirname, 'rules-audit');
const items = fs.readFileSync(path.join(AUD, 'items.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const byId = new Map(items.map(x => [x.id, x]));
const decided = new Map();
const dup = [];
const files = [path.join(AUD, 'auto-null.json')].concat(fs.readdirSync(path.join(AUD, 'decisions')).filter(f => f.endsWith('.json')).sort().map(f => path.join(AUD, 'decisions', f)));
for (const f of files) for (const d of JSON.parse(fs.readFileSync(f, 'utf8'))) { if (decided.has(d.id)) dup.push(d.id); decided.set(d.id, d.rule); }
const missing = items.filter(x => !decided.has(x.id));
const unknown = [...decided.keys()].filter(id => !byId.has(id));
const out = [];
for (const x of items) {
  const r = decided.get(x.id);
  if (!r) continue;
  out.push({ k: x.kind, o: x.owner, c: x.cls || '', n: x.name, r });
}
// Corrections with reasons (rules-audit/fixups.js)
for (const l of require('./rules-audit/fixups.js')(out, items)) console.log('fixup:', l);
fs.mkdirSync(path.join(ROOT, 'data', 'rules'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data', 'rules', 'features.json'), JSON.stringify(out));
const count = k => out.filter(e => e.r[k]).length;
console.log(`items ${items.length}, decided ${decided.size}, missing ${missing.length}, duplicates ${dup.length}, unknown ids ${unknown.length}`);
console.log(`rules ${out.length}: uses ${count('uses')}, roll ${count('roll')}, cost ${count('cost')}, bonuses ${out.filter(e => (e.r.bonuses || []).length).length}`);
if (missing.length) console.log('missing:', missing.slice(0, 20).map(x => `${x.id} ${x.name}`).join('; '));
if (missing.length || dup.length || unknown.length) process.exitCode = 1;
