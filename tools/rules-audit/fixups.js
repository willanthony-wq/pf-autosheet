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
  // Natural armor bonuses don't stack with each other: type them Natural Armor (the dragon disciple's increase stacks, so it
  // stays untyped)
  let nat = 0;
  for (const e of out) for (const b of e.r.bonuses || []) if (b.target === 'nat' && b.type === 'Untyped (stacks)' && !/increase/i.test(b.text || '')) {
    b.type = 'Natural Armor'; nat++;
    if (/typed Untyped because no natural type/i.test(e.r.note || '')) delete e.r.note;   // the audit's note from before the type existed
  }
  if (nat) log.push(`${nat} natural armor bonuses typed Natural Armor`);
  const S = 'Shield';
  // Shield bonuses the audit could only note (no Shield type then), from the full text
  const sa = find('class', 'Summoner', 'Shield Ally');
  if (sa) { sa.r.bonuses = (sa.r.bonuses || []).filter(b => b.target !== 'note').concat({ target: 'ac', value: 'cls >= 12 ? 4 : 2', type: S, situational: true, text: "Within eidolon's reach" }); delete sa.r.note; log.push('Shield Ally: shield bonus to AC'); }
  for (const [n, v] of [['Shielded Meld', 2], ['Greater Shielded Meld', 4]]) { const e = find('archetype', 'Synthesist', n); if (e) for (const b of e.r.bonuses || []) if (b.target === 'ac') { b.type = S; log.push(`${n}: Shield type`); } }
  const il = find('archetype', 'Monk of the Sacred Mountain', 'Iron Limb Defense');
  if (il) { il.r.bonuses = [{ target: 'ac', value: 2, type: S, situational: true, text: 'Started and ended the turn in the same space' }, { target: 'cmd', value: 2, type: S, situational: true, text: 'Started and ended the turn in the same space' },
    { target: 'ac', value: 4, type: S, situational: true, text: 'Same space, 1 ki spent (swift)' }, { target: 'cmd', value: 4, type: S, situational: true, text: 'Same space, 1 ki spent (swift)' }]; il.r.note = 'The 1 ki cost is only for the +4 option'; log.push('Iron Limb Defense: shield bonus to AC and CMD (+2, or +4 for 1 ki)'); }
  const ss = find('choice', 'magus / Magus arcana', 'Spell Shield');
  if (ss) { ss.r.bonuses = [{ target: 'ac', value: 'max(0, int)', type: S, situational: true, text: 'Until the end of your next turn' }]; log.push('Spell Shield: shield bonus equal to Int'); }
  // Inherent bonus, from the full text: "+2 inherent bonus to your Strength at 9th, +4 at 13th, +6 at 17th"
  if (ensure('choice-power', 'Abyssal (Bloodline)', 'Strength of the Abyss', { bonuses: [{ target: 'str', value: 'cls >= 17 ? 6 : cls >= 13 ? 4 : 2', type: 'Inherent', situational: false, text: 'Abyssal bloodline' }] })) log.push('Strength of the Abyss: inherent Strength');
  // Pools counted in skill ranks (formulas can name a skill's ranks since ranks_<skill> was added)
  // ----- From the owner's review of the audit's judgment calls (November 2026)
  // Shaman hexes: the class rule is 10 + 1/2 shaman level + Wisdom (Charisma in some hex texts is only a duration);
  // a hex with no saving throw has no DC
  let sh = 0;
  for (const e of out) {
    if (!((e.k === 'choice-pick' && /\(Spirit\)$/.test(e.o)) || /^shaman \/ /.test(e.o))) continue;
    for (const o of [e.r, e.r.roll]) if (o && typeof o.dc === 'string' && /\bcha\b/.test(o.dc)) { o.dc = o.dc.replace(/\bcha\b/, 'wis'); sh++; }
    if (e.r.note) e.r.note = e.r.note.replace(/\+ Cha\)/, '+ Wis)');
  }
  if (sh) log.push(`${sh} shaman hex DCs use Wisdom`);
  const ww = find('choice-pick', 'Wind (Spirit)', 'Wind Ward');
  if (ww && ww.r.dc) { delete ww.r.dc; ww.r.note = 'The ward allows no saving throw'; log.push('Wind Ward: no save DC'); }
  // Snow shroud: once per day at 9th, twice at 17th, three times at 20th; each use lasts up to sorcerer level rounds
  const sn = find('choice-power', 'Boreal (Bloodline)', 'Snow Shroud');
  if (sn) { sn.r.uses = { max: 'cls >= 20 ? 3 : cls >= 17 ? 2 : 1', unit: 'uses', per: 'day', note: 'Each use lasts up to sorcerer level rounds' }; delete sn.r.note; log.push('Snow Shroud: 1/2/3 uses per day, each up to sorcerer level rounds'); }
  // Divine retribution: Reflex half, DC 10 + 1/2 inquisitor level + Wisdom
  const dr = find('choice-power', 'Vengeance Inquisition (Inquisition)', 'Divine Retribution');
  if (dr) { dr.r.dc = '10 + floor(cls / 2) + wis'; dr.r.note = 'Reflex half'; log.push('Divine Retribution: DC 10 + 1/2 level + Wis'); }
  // Touch of Serenity: at least once per day
  const ts = find('feat', 'Feat', 'Touch of Serenity');
  if (ts && ts.r.uses) { ts.r.uses.max = 'max(1, floor(level / 4))'; delete ts.r.uses.note; log.push('Touch of Serenity: at least 1 use'); }
  if (ensure('archetype', 'Chameleon', 'Misdirection', { uses: { max: 'ranks_bluff', unit: 'points', per: 'day', note: 'Stealth points equal to ranks in Bluff' } })) log.push('Misdirection: stealth points = Bluff ranks');
  // The sheet's Monk Flurry attack type already applies the chained monk's -2: no separate switch for it
  const fl = find('class', 'Monk', 'Flurry of Blows');
  if (fl && fl.r.bonuses) { delete fl.r.bonuses; if (!Object.keys(fl.r).some(k => k !== 'note')) out.splice(out.indexOf(fl), 1); log.push('Monk Flurry of Blows: -2 left to the Monk Flurry attack type'); }
  return log;
};
