// Builds the audit input: every class feature, archetype ability, class choice (and its powers/picks), mythic ability,
// per-day feat and per-day racial feature, one JSON per line, split into partitions of about 350 items.
const fs = require('fs'), path = require('path');
const REPO = process.argv[2], OUT = path.join(__dirname, 'in');
fs.mkdirSync(OUT, { recursive: true });
const J = p => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));
const arr = j => (Array.isArray(j) ? j : (j.list || Object.values(j)));
const slug = n => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const HINT = /(\d+\s*(?:\+[^.]{0,40})?\s*times per day|rounds? per day|minutes? per day|hours? per day|per day|\/day|once per day|twice per day|a number of times per day[^.]*|pool[^.]{0,80}|\+\d+[^.]{0,30}bonus[^.]{0,80}|\b\d+d\d+\b|\bDC\s*(?:=|is|equal)?[^.]{0,60})/gi;
const hints = t => [...new Set((String(t || '').match(HINT) || []).map(x => x.trim()).slice(0, 12))];
const items = [];
const add = (group, o) => items.push(Object.assign({ group }, o, { hints: hints(o.text) }));

// Class tables (core + 3pp Machinesmith)
const classes = J('data/srd/classes.json');
for (const c of Object.values(classes)) {
  const lv = {};
  (c.levels || []).forEach((row, i) => (row || []).forEach(n => { const k = String(n).toLowerCase().replace(/\s*\(.*$/, '').replace(/\s*\d+.*$/, '').trim(); if (!(k in lv)) lv[k] = i + 1; }));
  for (const [k, f] of Object.entries(c.f || {})) add('class:' + slug(c.n), { kind: 'class', owner: c.n, cls: slug(c.n), name: f.n, level: lv[k] || null, text: f.d || '' });
}
try { const t = J('data/3pp/classes.json'); for (const c of Object.values(t)) for (const [k, f] of Object.entries(c.f || {})) add('class:' + slug(c.n), { kind: 'class', owner: c.n, cls: slug(c.n), name: f.n, level: null, text: f.d || '' }); } catch (e) { console.error('3pp classes', e.message); }
// Archetypes
for (const file of ['data/srd/archetypes.json', 'data/3pp/archetypes.json']) {
  for (const a of arr(J(file))) for (const ab of a.a || []) add('arch:' + slug(a.c), { kind: 'archetype', owner: a.n, cls: slug(a.c), name: ab.n, level: ab.l || null, text: ab.d || '' });
}
// Class choices: the choice itself, its powers by level (bloodline, domain, school...) and its sub-picks
for (const file of ['data/srd/choices.json', 'data/3pp/choices.json']) {
  for (const x of arr(J(file))) {
    const cls = slug(x.c), grp = `${x.c} / ${x.g}`;
    add('choice:' + slug(x.c) + ':' + slug(x.g), { kind: 'choice', owner: grp, cls, name: x.n, level: x.l || null, text: x.d || '' });
    for (const p of x.p || []) add('power:' + slug(x.c) + ':' + slug(x.g), { kind: 'choice-power', owner: `${x.n} (${x.g})`, cls, name: p.n, level: p.l || null, text: p.d || '' });
    for (const p of x.picks || []) add('pick:' + slug(x.c) + ':' + slug(x.g), { kind: 'choice-pick', owner: `${x.n} (${x.g})`, cls, name: p.n, level: p.l || null, text: p.d || '' });
  }
}
// Mythic
const my = J('data/srd/mythic.json');
for (const b of my.base) add('mythic', { kind: 'mythic', owner: 'Base', cls: 'tier', name: b.n, level: b.l || null, text: b.d || '' });
for (const u of my.universal) add('mythic', { kind: 'mythic', owner: 'Universal', cls: 'tier', name: u.n, level: u.l || null, text: u.d || '' });
for (const p of my.paths) {
  if (p.feature) for (const o of p.feature.options || []) add('mythic', { kind: 'mythic', owner: p.n + ' feature', cls: 'tier', name: o.n, level: 1, text: o.d || '' });
  if (p.capstone) add('mythic', { kind: 'mythic', owner: p.n, cls: 'tier', name: p.capstone.n, level: 10, text: p.capstone.d || '' });
  for (const a of p.abilities || []) add('mythic', { kind: 'mythic', owner: p.n, cls: 'tier', name: a.n, level: a.l || null, text: a.d || '' });
}
// Feats with per-day uses or that extend a pool ("Extra Rage")
for (const f of arr(J('data/srd/feats.json'))) {
  const t = [f.d, f.b].filter(Boolean).join(' ');
  if (/times per day|per day|rounds per day|\/day/i.test(t) || /^Extra /i.test(f.n)) add('feat', { kind: 'feat', owner: 'Feat', cls: '', name: f.n, level: null, text: t });
}
// Racial features with per-day uses
for (const r of arr(J('data/srd/races.json'))) for (const [n, t] of r.features || []) if (/per day|\/day|once per|times per/i.test(n + ' ' + t)) add('race', { kind: 'race', owner: r.n, cls: '', name: n, level: null, text: t || '' });

// Partition: keep groups together, about 350 items each
items.forEach((x, i) => { x.id = 'F' + String(i + 1).padStart(5, '0'); });
const parts = []; let cur = [], curGroup = null;
const byGroup = {};
for (const x of items) (byGroup[x.group.split(':').slice(0, 2).join(':')] = byGroup[x.group.split(':').slice(0, 2).join(':')] || []).push(x);
for (const g of Object.values(byGroup)) { if (cur.length && cur.length + g.length > 380) { parts.push(cur); cur = []; } cur = cur.concat(g); }
if (cur.length) parts.push(cur);
parts.forEach((p, i) => fs.writeFileSync(path.join(OUT, `part${String(i + 1).padStart(2, '0')}.jsonl`), p.map(x => JSON.stringify({ id: x.id, kind: x.kind, owner: x.owner, cls: x.cls, name: x.name, level: x.level, text: x.text, hints: x.hints })).join('\n') + '\n'));
fs.writeFileSync(path.join(__dirname, 'all-ids.json'), JSON.stringify(items.map(x => x.id)));
console.log('items', items.length, 'parts', parts.length, parts.map(p => p.length + ':' + [...new Set(p.map(x => x.kind))].join('/') + ':' + p[0].owner + '..' + p[p.length - 1].owner).join(' | '));
