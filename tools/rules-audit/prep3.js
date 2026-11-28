// Third pass, on the full (untruncated) rules text in in_full/:
// - a decision from the first round is kept only if that item's text was complete when it was decided
//   (matched by kind + owner + name, since ids shifted by one item);
// - items whose full text mentions no bonus, uses, pool, dice or DC are null (auto-null-full.json);
// - everything else not yet decided goes to in3/ in parts of at most 100, with the full text.
const fs = require('fs'), path = require('path');
const D = __dirname;
const load = dir => { const out = []; for (const f of fs.readdirSync(path.join(D, dir)).sort()) for (const l of fs.readFileSync(path.join(D, dir, f), 'utf8').split('\n').filter(Boolean)) out.push(JSON.parse(l)); return out; };
const oldItems = load('in'), full = load('in_full');
const sig = x => `${x.kind}|${x.owner}|${x.name}`;
const oldBySig = new Map(oldItems.map(x => [sig(x), x]));
const oldDec = new Map();
for (const f of fs.readdirSync(path.join(D, 'out')).filter(f => /^p\d+\.json$/.test(f))) for (const d of JSON.parse(fs.readFileSync(path.join(D, 'out', f), 'utf8'))) oldDec.set(d.id, d.rule);
const RE = /\bbonus|\bpenalt|per day|\/day|times per|rounds|\bpool\b|\bpoints?\b|\b\d+d\d+\b|\bd\d+\b|\bDC\b|\buses?\b|daily|once per|twice per|\bextra\b/i;
const kept = [], autoNull = [], review = [];
for (const x of full) {
  const o = oldBySig.get(sig(x));
  const wasWhole = o && !/…\s*$/.test(o.text);
  if (o && wasWhole && oldDec.has(o.id)) { kept.push({ id: x.id, rule: oldDec.get(o.id) }); continue; }
  if (!(RE.test(x.text) || x.kind === 'feat')) { autoNull.push({ id: x.id, rule: null, why: 'full text mentions no bonus, uses, pool, dice or DC' }); continue; }
  review.push(x);
}
fs.writeFileSync(path.join(D, 'kept-round1.json'), JSON.stringify(kept));
fs.writeFileSync(path.join(D, 'auto-null-full.json'), JSON.stringify(autoNull));
fs.mkdirSync(path.join(D, 'in3'), { recursive: true });
for (const f of fs.readdirSync(path.join(D, 'in3'))) fs.unlinkSync(path.join(D, 'in3', f));
const parts = []; let cur = [];
for (const x of review) { if (cur.length >= 100) { parts.push(cur); cur = []; } cur.push(x); }
if (cur.length) parts.push(cur);
parts.forEach((p, i) => fs.writeFileSync(path.join(D, 'in3', `q${String(i + 1).padStart(2, '0')}.jsonl`), p.map(x => JSON.stringify(x)).join('\n') + '\n'));
console.log(`full ${full.length}: kept ${kept.length}, auto-null ${autoNull.length}, to review ${review.length} in ${parts.length} parts`);
console.log(parts.map((p, i) => `q${String(i + 1).padStart(2, '0')}:${p.length}:${p[0].kind}/${p[0].owner}..${p[p.length - 1].owner}`).join('\n'));
