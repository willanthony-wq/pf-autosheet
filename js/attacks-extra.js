// Extra attack formulas beyond the Autosheet's list: INT and CHA to hit, each with the usual damage choices.
// Appended to PF_DATA.attackCategories (data.js stays a straight copy of the spreadsheet).
(function () {
  'use strict';
  const cats = window.PF_DATA.attackCategories;
  const cat = name => cats.find(c => c.name === name || c.name.startsWith(name));
  const add = (category, label, atk, dmg) => {
    const c = cat(category);
    if (c && !c.options.some(o => o.label === label)) c.options.push({ label, atk, dmg, extra: true });
  };

  for (const [A, a] of [['INT', 'v.int'], ['CHA', 'v.cha']]) {
    const mAtk = `v.bab+${a}+v.sizeAtk+v.tMeleeAttack`;
    const rAtk = `v.bab+${a}+v.sizeAtk+v.tRangedAttack`;

    // Melee (iterative attacks)
    add('Melee Attack', `${A} to hit, STR to damage`, mAtk, 'v.str+v.tMeleeDamage');
    add('Melee Attack', `${A} to hit, STR*1.5 to damage (Two-Handed)`, mAtk, 'FL(v.str*1.5)+v.tMeleeDamage+v.t2HDamage');
    add('Melee Attack', `${A} to hit, ${A} to damage`, mAtk, `${a}+v.tMeleeDamage`);
    add('Melee Attack', `${A} to hit, ${A}*1.5 to damage (Two-Handed)`, mAtk, `FL(${a}*1.5)+v.tMeleeDamage+v.t2HDamage`);
    add('Melee Attack', `${A} to hit, DEX to damage`, mAtk, 'v.dex+v.tMeleeDamage');
    add('Melee Attack', `${A} to hit (no ability to damage)`, mAtk, 'v.tMeleeDamage');

    // Off-hand melee
    add('Off-Hand Melee', `${A} to hit, STR*0.5 to damage (Standard Off-Hand)`, mAtk, 'RD(0.5*v.str)+v.tMeleeDamage+v.tOHDamage');
    add('Off-Hand Melee', `${A} to hit, STR to damage (Double Slice)`, mAtk, 'v.str+v.tMeleeDamage+v.tOHDamage');
    add('Off-Hand Melee', `${A} to hit, ${A}*0.5 to damage`, mAtk, `RD(0.5*${a})+v.tMeleeDamage+v.tOHDamage`);
    add('Off-Hand Melee', `${A} to hit, ${A} to damage (Double Slice)`, mAtk, `${a}+v.tMeleeDamage+v.tOHDamage`);

    // Ranged (iterative attacks, Rapid Shot etc.)
    add('Ranged Attack', `${A} to hit`, rAtk, 'v.tRangedDamage');
    add('Ranged Attack', `${A} to hit, STR to damage (Composite Bows, Thrown Weapons)`, rAtk, 'v.str+v.tRangedDamage');
    add('Ranged Attack', `${A} to hit, ${A} to damage`, rAtk, `${a}+v.tRangedDamage`);
    add('Ranged Attack', `${A} to hit, DEX to damage`, rAtk, 'v.dex+v.tRangedDamage');

    // Off-hand ranged
    add('Off-Hand Ranged', `${A} to hit`, rAtk, 'v.tRangedDamage');
    add('Off-Hand Ranged', `${A} to hit, STR*0.5 to damage (Thrown Weapons)`, rAtk, 'RD(0.5*v.str)+v.tRangedDamage');
    add('Off-Hand Ranged', `${A} to hit, ${A} to damage`, rAtk, `${a}+v.tRangedDamage`);

    // Combat maneuvers
    add('Combat Maneuver', `${A} to hit`, `v.bab+${a}+v.sizeCmb+v.tMeleeAttack`, null);

    // Single attacks
    add('Single Attack', `Melee: ${A} to hit, STR to damage`, mAtk, 'v.str+v.tMeleeDamage');
    add('Single Attack', `Melee: ${A} to hit, ${A} to damage`, mAtk, `${a}+v.tMeleeDamage`);
    add('Single Attack', `Ranged: ${A} to hit`, rAtk, 'v.tRangedDamage');
    add('Single Attack', `Ranged: ${A} to hit, STR to damage`, rAtk, 'v.str+v.tRangedDamage');
    add('Single Attack', `Ranged: ${A} to hit, ${A} to damage`, rAtk, `${a}+v.tRangedDamage`);
  }
  // Which ability a formula uses to hit, for grouping the dropdown.
  window.PF_ATTACK_GROUP = function (label) {
    const m = String(label).match(/^(?:Melee: |Ranged: )?(STR|DEX|CON|INT|WIS|CHA)\b/);
    if (m) return m[1] + ' to hit';
    if (/Caster Level|Concentration|Spell-Based|CL \+/.test(label)) return 'Spellcasting';
    return 'Other';
  };

  // Shields from the rules data that the spreadsheet's table doesn't list (same format: ACP as a positive number, ASF as a fraction)
  const shields = window.PF_DATA.shields;
  for (const sh of [{ name: 'Quickdraw Shield (light, wood or steel)', ac: 1, maxDex: null, acp: 2, asf: 0.05, type: 'Light' }]) {
    if (!shields.some(x => x.name === sh.name)) shields.splice(Math.max(1, shields.findIndex(x => x.type === 'Heavy')), 0, sh);
  }
})();
