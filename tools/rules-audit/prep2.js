// Second pass: items whose text never mentions a bonus, penalty, uses, rounds, a pool, points, dice or a DC have
// nothing to count, roll or add: they are recorded as null (auto-null.json). The rest is split into parts of
// at most 120 items (groups kept together where possible) in in2/.
const fs = require('fs'), path = require('path');
const IN = path.join(__dirname, 'in'), OUT = path.join(__dirname, 'in2');
fs.mkdirSync(OUT, { recursive: true });
const RE = /\bbonus|\bpenalt|per day|\/day|times per|rounds|\bpool\b|\bpoints?\b|\b\d+d\d+\b|\bd\d+\b|\bDC\b|\buses?\b|daily|once per|twice per|\bextra\b/i;
const all = [];
for (const f of fs.readdirSync(IN).sort()) for (const l of fs.readFileSync(path.join(IN, f), 'utf8').split('\n').filter(Boolean)) all.push(JSON.parse(l));
const review = all.filter(x => RE.test(x.text) || x.kind === 'feat');
const auto = all.filter(x => !review.includes(x));
fs.writeFileSync(path.join(__dirname, 'auto-null.json'), JSON.stringify(auto.map(x => ({ id: x.id, rule: null, why: 'text mentions no bonus, uses, pool, dice or DC' }))));
const parts = []; let cur = [];
for (const x of review) { if (cur.length >= 120) { parts.push(cur); cur = []; } cur.push(x); }
if (cur.length) parts.push(cur);
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
parts.forEach((p, i) => fs.writeFileSync(path.join(OUT, `p${String(i + 1).padStart(2, '0')}.jsonl`), p.map(x => JSON.stringify(x)).join('\n') + '\n'));
console.log('all', all.length, 'auto-null', auto.length, 'review', review.length, 'parts', parts.length);
console.log(parts.map((p, i) => `p${String(i + 1).padStart(2, '0')}:${p.length}:${p[0].kind}/${p[0].owner}..${p[p.length - 1].owner}`).join('\n'));
