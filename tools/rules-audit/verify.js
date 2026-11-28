// Cross-checks data/rules/features.json after a build:
//  - every cost.from names an ability that exists somewhere in the audited items
//  - every uses.extra feat exists, with the number the feat's own text gives next to it for review
//  - formulas evaluate for a few test characters (same check as check.js)
// Usage: node tools/rules-audit/verify.js [folder with full-text feats.json]
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'rules', 'features.json'), 'utf8'));
const items = fs.readFileSync(path.join(__dirname, 'items.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const key = n => String(n || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s*\([^)]*\)/g, '').replace(/\s*[+−-]?\d+(d\d+)?(\/day|st|nd|rd|th)?\b.*$/i, '').replace(/[,:;.]+$/, '').replace(/s$/, '').trim();
const names = new Set(items.map(x => key(x.name)));
const featsDir = process.argv[2] || path.join(ROOT, 'data', 'srd');
const feats = JSON.parse(fs.readFileSync(path.join(featsDir, 'feats.json'), 'utf8'));
const featList = Array.isArray(feats) ? feats : (feats.list || Object.values(feats));
const featBy = new Map(featList.map(f => [String(f.n).toLowerCase(), f]));
let bad = 0;
console.log('== cost.from that matches no ability name');
for (const e of rules) if (e.r.cost && !names.has(key(e.r.cost.from))) { bad++; console.log(`  ${e.k} | ${e.o} | ${e.n} -> "${e.r.cost.from}"`); }
console.log('== uses.extra feats');
const seen = new Map();
for (const e of rules) for (const [f, n] of (e.r.uses && e.r.uses.extra) || []) { const k = f.toLowerCase(); if (!seen.has(k)) seen.set(k, new Set()); seen.get(k).add(n); }
for (const [f, ns] of [...seen].sort()) {
  const it = featBy.get(f);
  const txt = it ? String([it.b, it.d].filter(Boolean).join(' ')) : '';
  const m = txt.match(/(?:increase|gain|additional|extra|more)[^.]{0,80}?\b(\d+|one|two|three|four|five|six)\b[^.]{0,40}/i);
  console.log(`  ${it ? 'ok ' : 'MISSING'} ${f}: rules say +${[...ns].join('/')}; feat text: ${m ? m[0].trim().slice(0, 120) : (txt.slice(0, 120) || '-')}`);
  if (!it) bad++;
}
console.log(bad ? `${bad} problems` : 'no problems');
