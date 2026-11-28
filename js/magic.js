// Magic item abilities: weapon special abilities (keen, flaming, holy...), armor and shield special abilities
// (shadow, fortification, energy resistance...), and the rules for making wands, scrolls and potions.
// Rules from the Pathfinder Roleplaying Game Core Rulebook, Advanced Player's Guide and Ultimate Equipment (OGL).
(function () {
  'use strict';
  // Weapon abilities. b = bonus equivalent (+1..+5) or gp = flat price; dmg = extra dice on every hit;
  // crit = extra dice on a confirmed crit by multiplier (burst, thundering); vs = extra dice only against some foes;
  // keen doubles the threat range; speed gives one extra attack at the highest bonus in a full attack;
  // pick = what to choose (bane's creature type); only = 'melee' | 'ranged' | 'slashing/piercing'; note = rules in short
  const BURST = { 2: '1d10', 3: '2d10', 4: '3d10' };
  const WEAPON = [
    { n: 'Agile', b: 1, only: 'melee', note: 'Use Dex instead of Str for damage (light or finesse weapons); doesn\'t stack with other ways to add Dex to damage.' },
    { n: 'Allying', b: 1, note: 'As a free action, transfer some or all of the weapon\'s enhancement bonus to one ally\'s weapon.' },
    { n: 'Anarchic', b: 2, vs: { dice: '2d6', type: 'chaotic', foe: 'lawful foes' }, note: 'Chaotic-aligned; +2d6 damage against lawful creatures; a lawful wielder gains a negative level.' },
    { n: 'Axiomatic', b: 2, vs: { dice: '2d6', type: 'lawful', foe: 'chaotic foes' }, note: 'Lawful-aligned; +2d6 damage against chaotic creatures; a chaotic wielder gains a negative level.' },
    { n: 'Bane', b: 1, pick: 'creature type', vs: { dice: '2d6', type: '', foe: 'bane foes', atk: 2, bonus: 2 }, note: 'Against the chosen creature type: +2 enhancement bonus (attack and damage) and +2d6 damage.' },
    { n: 'Brilliant energy', b: 4, note: 'Ignores nonliving matter: armor and shield bonuses (including enhancement) don\'t count against it. Can\'t harm undead, constructs or objects.' },
    { n: 'Corrosive', b: 1, dmg: { dice: '1d6', type: 'acid' }, note: '+1d6 acid damage on a successful hit.' },
    { n: 'Corrosive burst', b: 2, dmg: { dice: '1d6', type: 'acid' }, crit: { type: 'acid', by: BURST }, note: '+1d6 acid; on a critical hit +1d10 acid (+2d10 for x3, +3d10 for x4).' },
    { n: 'Courageous', b: 1, note: 'Morale bonuses to saves against fear are increased by half the weapon\'s enhancement bonus.' },
    { n: 'Cunning', b: 1, note: 'Critical threats against creatures you identified with Knowledge get +2 on confirmation (more with higher enhancement).' },
    { n: 'Dancing', b: 4, only: 'melee', note: 'Can be loosed to fight on its own for 4 rounds, attacking with your base attack bonus.' },
    { n: 'Defending', b: 1, only: 'melee', note: 'Move some or all of the enhancement bonus to your AC, as a bonus that stacks, until your next turn.' },
    { n: 'Disruption', b: 2, only: 'melee', note: 'Bludgeoning only. Undead struck must succeed on a DC 14 Will save or be destroyed.' },
    { n: 'Distance', b: 1, only: 'ranged', note: 'Doubles the range increment.' },
    { n: 'Flaming', b: 1, dmg: { dice: '1d6', type: 'fire' }, note: '+1d6 fire damage on a successful hit.' },
    { n: 'Flaming burst', b: 2, dmg: { dice: '1d6', type: 'fire' }, crit: { type: 'fire', by: BURST }, note: '+1d6 fire; on a critical hit +1d10 fire (+2d10 for x3, +3d10 for x4).' },
    { n: 'Frost', b: 1, dmg: { dice: '1d6', type: 'cold' }, note: '+1d6 cold damage on a successful hit.' },
    { n: 'Furious', b: 1, only: 'melee', note: 'While you rage, the enhancement bonus is 2 higher (max +5).' },
    { n: 'Ghost touch', b: 1, note: 'Deals damage normally to incorporeal creatures and can be picked up by them.' },
    { n: 'Holy', b: 2, vs: { dice: '2d6', type: 'good', foe: 'evil foes' }, note: 'Good-aligned; +2d6 damage against evil creatures; an evil wielder gains a negative level.' },
    { n: 'Icy burst', b: 2, dmg: { dice: '1d6', type: 'cold' }, crit: { type: 'cold', by: BURST }, note: '+1d6 cold; on a critical hit +1d10 cold (+2d10 for x3, +3d10 for x4).' },
    { n: 'Impact', b: 2, only: 'melee', note: 'Bludgeoning only. Damage dice as if one size category larger.' },
    { n: 'Keen', b: 1, keen: true, only: 'slashing/piercing', note: 'Doubles the threat range. Doesn\'t stack with Improved Critical or other ways to widen it.' },
    { n: 'Ki focus', b: 1, only: 'melee', note: 'A monk can deliver ki attacks (stunning fist and the like) through the weapon.' },
    { n: 'Menacing', b: 1, only: 'melee', note: 'When you flank, the flanking bonus on attack rolls is +4 instead of +2 (for you and allies flanking with you).' },
    { n: 'Merciful', b: 1, dmg: { dice: '1d6', type: 'nonlethal' }, note: '+1d6 damage, and all of the weapon\'s damage is nonlethal (can be switched off).' },
    { n: 'Mighty cleaving', b: 1, only: 'melee', note: 'With Cleave, you can make one more attack when the extra attack hits.' },
    { n: 'Returning', b: 1, only: 'ranged', note: 'A thrown weapon flies back to your hand at the start of your next turn.' },
    { n: 'Seeking', b: 1, only: 'ranged', note: 'Ignores miss chances from concealment (not total cover).' },
    { n: 'Shock', b: 1, dmg: { dice: '1d6', type: 'electricity' }, note: '+1d6 electricity damage on a successful hit.' },
    { n: 'Shocking burst', b: 2, dmg: { dice: '1d6', type: 'electricity' }, crit: { type: 'electricity', by: BURST }, note: '+1d6 electricity; on a critical hit +1d10 electricity (+2d10 for x3, +3d10 for x4).' },
    { n: 'Speed', b: 3, speed: true, note: 'In a full attack, one extra attack at your highest bonus. Doesn\'t stack with haste.' },
    { n: 'Spell storing', b: 1, only: 'melee', note: 'Holds one spell of up to 3rd level that is cast on a creature it hits.' },
    { n: 'Throwing', b: 1, only: 'melee', note: 'Can be thrown with a range increment of 10 ft.' },
    { n: 'Thundering', b: 1, crit: { type: 'sonic', by: { 2: '1d8', 3: '2d8', 4: '3d8' } }, note: 'On a critical hit +1d8 sonic (+2d8 for x3, +3d8 for x4); the target is deafened unless it saves (DC 14 Fort).' },
    { n: 'Unholy', b: 2, vs: { dice: '2d6', type: 'evil', foe: 'good foes' }, note: 'Evil-aligned; +2d6 damage against good creatures; a good wielder gains a negative level.' },
    { n: 'Vicious', b: 1, only: 'melee', dmg: { dice: '2d6', type: '' }, note: '+2d6 damage on a hit, and the wielder takes 1d6 damage.' },
    { n: 'Vorpal', b: 5, keen: false, only: 'slashing/piercing', note: 'Slashing only. On a confirmed natural 20 critical, the target\'s head is severed.' },
    { n: 'Wounding', b: 2, note: 'Each hit causes 1 point of bleed damage.' },
  ];
  // Armor and shield abilities. bonuses use the sheet's bonus format (skill bonuses, saves...);
  // def = a defense line (DR, resistance, SR, fortification); pick = what to choose (energy type)
  const ENERGY = ['acid', 'cold', 'electricity', 'fire', 'sonic'];
  const skill = (s, v) => [{ target: 'skill', skill: s, value: v, type: 'Competence' }];
  const ARMOR = [
    { n: 'Arrow catching', b: 1, shield: true, note: '+1 deflection bonus to AC against ranged weapons; ranged attacks at nearby allies may be diverted to you.' },
    { n: 'Arrow deflection', b: 2, shield: true, note: 'Once a round, deflect a ranged attack aimed at you (DC 20 Reflex, +attack bonus over 20).' },
    { n: 'Animated', b: 2, shield: true, note: 'Release the shield to float beside you and protect you for 4 rounds, leaving both hands free.' },
    { n: 'Bashing', b: 1, shield: true, note: 'Shield bashes deal damage as a weapon two sizes larger, with the shield\'s enhancement on attack and damage.' },
    { n: 'Blinding', b: 1, shield: true, note: 'Twice a day, flashes: creatures within 20 ft. are blinded 1d4 rounds (DC 14 Reflex negates).' },
    { n: 'Champion', b: 1, note: 'When you use challenge, +2 sacred bonus to AC against the challenged creature.' },
    { n: 'Energy resistance', b: 0, gp: 18000, pick: 'energy', def: 'resist {pick} 10', note: 'Resist 10 against the chosen energy type.' },
    { n: 'Improved energy resistance', b: 0, gp: 42000, pick: 'energy', def: 'resist {pick} 20', note: 'Resist 20 against the chosen energy type.' },
    { n: 'Greater energy resistance', b: 0, gp: 66000, pick: 'energy', def: 'resist {pick} 30', note: 'Resist 30 against the chosen energy type.' },
    { n: 'Etherealness', b: 0, gp: 49000, note: 'Once a day, become ethereal (as ethereal jaunt).' },
    { n: 'Light fortification', b: 1, def: 'fortification 25%', note: '25% chance to ignore a critical hit or sneak attack (damage rolled normally).' },
    { n: 'Moderate fortification', b: 3, def: 'fortification 50%', note: '50% chance to ignore a critical hit or sneak attack.' },
    { n: 'Heavy fortification', b: 5, def: 'fortification 75%', note: '75% chance to ignore a critical hit or sneak attack.' },
    { n: 'Ghost touch', b: 3, note: 'The armor or shield bonus counts against incorporeal attacks; incorporeal creatures can wear it.' },
    { n: 'Glamered', b: 0, gp: 2700, note: 'On command, looks like normal clothing (Will DC 16 to see through).' },
    { n: 'Invulnerability', b: 3, def: 'DR 5/magic', note: 'DR 5/magic.' },
    { n: 'Reflecting', b: 5, shield: true, note: 'Once a day, reflect a spell back at its caster (as spell turning).' },
    { n: 'Shadow', b: 0, gp: 3750, bonuses: skill('Stealth', 5), note: '+5 competence bonus on Stealth checks.' },
    { n: 'Improved shadow', b: 0, gp: 15000, bonuses: skill('Stealth', 10), note: '+10 competence bonus on Stealth checks.' },
    { n: 'Greater shadow', b: 0, gp: 33750, bonuses: skill('Stealth', 15), note: '+15 competence bonus on Stealth checks.' },
    { n: 'Slick', b: 0, gp: 3750, bonuses: skill('Escape Artist', 5), note: '+5 competence bonus on Escape Artist checks.' },
    { n: 'Improved slick', b: 0, gp: 15000, bonuses: skill('Escape Artist', 10), note: '+10 competence bonus on Escape Artist checks.' },
    { n: 'Greater slick', b: 0, gp: 33750, bonuses: skill('Escape Artist', 15), note: '+15 competence bonus on Escape Artist checks.' },
    { n: 'Spell resistance (13)', b: 2, def: 'SR 13', note: 'Spell resistance 13.' },
    { n: 'Spell resistance (15)', b: 3, def: 'SR 15', note: 'Spell resistance 15.' },
    { n: 'Spell resistance (17)', b: 4, def: 'SR 17', note: 'Spell resistance 17.' },
    { n: 'Spell resistance (19)', b: 5, def: 'SR 19', note: 'Spell resistance 19.' },
    { n: 'Wild', b: 3, note: 'The armor bonus (and enhancement) counts while you\'re wild shaped; it melds into your form.' },
  ];
  const byName = (list, n) => list.find(a => a.n.toLowerCase() === String(n || '').split(':')[0].trim().toLowerCase());
  // A chosen ability is stored as its name, or "Name: choice" (Bane: undead, Energy resistance: fire)
  const parse = s => { const [n, ...rest] = String(s || '').split(':'); return { n: n.trim(), pick: rest.join(':').trim() }; };
  function weaponAbilities(w) { return (Array.isArray(w && w.abilities) ? w.abilities : []).map(s => { const p = parse(s), a = byName(WEAPON, p.n); return a ? Object.assign({}, a, { pick: p.pick, raw: s }) : null; }).filter(Boolean); }
  function armorAbilities(x) { return (Array.isArray(x && x.abilities) ? x.abilities : []).map(s => { const p = parse(s), a = byName(ARMOR, p.n); return a ? Object.assign({}, a, { pick: p.pick, raw: s }) : null; }).filter(Boolean); }
  // Abilities named in an item's name ("+1 keen flaming longsword", "Longsword +1 Keen, Flaming"): longest names first
  function abilitiesInName(name, armor) {
    let s = ' ' + String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
    const out = [];
    const list = (armor ? ARMOR : WEAPON).slice().sort((a, b) => b.n.length - a.n.length);
    for (const a of list) {
      const key = ' ' + a.n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
      if (a.pick || !s.includes(key)) continue;
      out.push(a.n);
      s = s.replace(key, ' ');
    }
    // "fire resistance", "improved cold resistance": energy resistance with that energy
    if (armor) s.replace(/ (?:(improved|greater) )?(acid|cold|electricity|fire|sonic) resistance /g, (m, g, e) => { out.push(`${g ? g.charAt(0).toUpperCase() + g.slice(1) + ' energy' : 'Energy'} resistance: ${e}`); return ' '; });
    return out.sort();
  }
  // "+1 keen flaming longsword" -> "longsword" (to look up the weapon's own threat range)
  function baseWeaponName(name) {
    let s = ' ' + String(name || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[+]\d+/g, ' ').replace(/[,;]/g, ' ') + ' ';
    for (const a of WEAPON.slice().sort((x, y) => y.n.length - x.n.length)) s = s.split(' ' + a.n.toLowerCase() + ' ').join(' ');
    return s.replace(/\b(masterwork|mwk)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // The weapon's own threat range, widened by keen: "19-20" -> "17-20"
  function keenRange(crit) {
    const low = Math.max(1, Math.min(20, parseInt((String(crit || '20').match(/\d+/) || ['20'])[0], 10)));
    const width = 21 - low;
    const nl = Math.max(2, 21 - width * 2);
    return nl >= 20 ? '20' : `${nl}-20`;
  }
  // Total bonus and price of the magic: weapons (bonus)^2 x 2,000 gp, armor and shields (bonus)^2 x 1,000 gp, plus flat-priced abilities
  function magicPrice(enh, abilities, armor) {
    const e = Math.max(0, parseInt(enh, 10) || 0);
    const bonus = e + abilities.reduce((t, a) => t + (a.b || 0), 0);
    const flat = abilities.reduce((t, a) => t + (a.gp || 0), 0);
    return { bonus, gp: bonus * bonus * (armor ? 1000 : 2000) + flat, flat, tooHigh: bonus > 10, needsEnh: abilities.some(a => a.b) && e < 1 };
  }

  // ----- Wands, scrolls and potions
  // Lowest caster level for a spell level (cleric, druid, wizard; a sorcerer or bard's can be higher)
  const MIN_CL = [1, 1, 3, 5, 7, 9, 11, 13, 15, 17];
  const KINDS = {
    wand: { label: 'Wand', maxLevel: 4, per: 750, charges: 50, note: 'Use activated: a standard action that provokes. 50 charges.' },
    scroll: { label: 'Scroll', maxLevel: 9, per: 25, charges: 0, note: 'Spell completion: the spell must be on your list; reading it uses the scroll up.' },
    potion: { label: 'Potion', maxLevel: 3, per: 50, charges: 0, note: 'Drink it (standard action that provokes); it works on the drinker. Only spells that target creatures.' },
  };
  // Price: spell level x caster level x 750 (wand), 25 (scroll), 50 (potion); a 0-level spell counts as level 1/2
  function itemPrice(kind, sl, cl) { const k = KINDS[kind]; return k ? Math.round(k.per * (sl === 0 ? 0.5 : sl) * Math.max(1, cl)) : 0; }
  // Save DC: 10 + spell level + the lowest ability modifier that can cast it
  function itemDC(sl) { return 10 + sl + Math.floor(sl / 2); }
  function itemName(kind, spell, cl) {
    const k = KINDS[kind];
    const nice = String(spell || '').trim().replace(/\b([a-z])/g, (m, c) => c.toUpperCase()).replace(/\b(Of|The|And|To|In|On|At|By)\b/g, w => w.toLowerCase());
    return `${k ? k.label : 'Item'} of ${nice}${cl ? ` (CL ${cl})` : ''}`;
  }
  // "Wand of cure light wounds (CL 3)" -> { kind: 'wand', spell: 'cure light wounds', cl: 3 }
  function parseItemName(name) {
    const m = String(name || '').trim().match(/^(wand|scroll|potion|oil)s?\s+of\s+(.+?)\s*(?:\((?:cl\s*)?(\d+)(?:th|st|nd|rd)?(?:\s*level)?\))?\s*(?:\(\d+\s*charges?\))?$/i);
    if (!m) return null;
    return { kind: m[1].toLowerCase() === 'oil' ? 'potion' : m[1].toLowerCase(), spell: m[2].replace(/\s*\(.*$/, '').trim(), cl: m[3] ? +m[3] : null };
  }

  window.PF_MAGIC = { WEAPON, ARMOR, ENERGY, KINDS, MIN_CL, baseWeaponName, weaponAbilities, armorAbilities, abilitiesInName, keenRange, magicPrice, itemPrice, itemDC, itemName, parseItemName, byName, parse };
})();
