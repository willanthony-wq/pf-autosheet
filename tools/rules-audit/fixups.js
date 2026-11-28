// Corrections applied on top of the audit decisions when tools/build_rules.js runs, each with its reason.
// out: the built entries ({ k, o, c, n, r }); items: every audited item (to add a rule to an item decided null).
module.exports = function fixups(out, items) {
  const log = [];
  const find = (k, o, n) => out.find(e => e.k === k && e.o.toLowerCase() === o.toLowerCase() && e.n.toLowerCase() === n.toLowerCase());
  const ensure = (k, o, n, r) => {
    let e = find(k, o, n);
    if (!e) { const it = items.find(x => x.kind === k && x.owner.toLowerCase() === o.toLowerCase() && x.name.toLowerCase() === n.toLowerCase()); if (!it) return null; e = { k, o: it.owner, c: it.cls || '', n: it.name, r: {} }; out.push(e); }
    Object.assign(e.r, r);
    return e;
  };
  // Extra feats: the numbers the feats' own text gives (verify.js compares them)
  const extraFix = { 'extra arcane pool': 2, 'extra summons': 1 };
  for (const e of out) for (const x of (e.r.uses && e.r.uses.extra) || []) {
    const want = extraFix[x[0].toLowerCase()];
    if (want !== undefined && x[1] !== want) { log.push(`${e.n}: ${x[0]} ${x[1]} -> ${want}`); x[1] = want; }
  }
  // Warpriest blessings share one pool: 3 + 1/2 warpriest level uses per day, in any combination (Advanced Class Guide).
  // The class feature holds the counter; each blessing power spends one use of it.
  if (ensure('class', 'Warpriest', 'Blessings', { uses: { max: '3 + floor(cls / 2)', unit: 'uses', per: 'day', note: 'Shared by all blessing powers' } })) log.push('Warpriest Blessings: shared pool 3 + 1/2 level');
  let n = 0;
  for (const e of out) if (/\(Blessing\)$/.test(e.o) && e.r.uses) { delete e.r.uses; e.r.cost = { from: 'Blessings', n: 1 }; n++; }
  if (n) log.push(`${n} blessing powers spend 1 use of Blessings`);
  // The sheet's Monk Flurry attack type already applies the chained monk's -2: no separate switch for it
  const fl = find('class', 'Monk', 'Flurry of Blows');
  if (fl && fl.r.bonuses) { delete fl.r.bonuses; if (!Object.keys(fl.r).some(k => k !== 'note')) out.splice(out.indexOf(fl), 1); log.push('Monk Flurry of Blows: -2 left to the Monk Flurry attack type'); }
  return log;
};
