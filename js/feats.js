// Standard bonuses for common feats and traits, offered when a feat or trait name matches.
// Values may be formulas: level, bab, str..cha (modifiers), ranks (ranks in the skill the bonus targets).
(function () {
  'use strict';
  const U = 'Untyped (stacks)';
  const skillPair = (a, b) => [
    { target: 'skill', skill: a, value: 'ranks >= 10 ? 4 : 2', type: U },
    { target: 'skill', skill: b, value: 'ranks >= 10 ? 4 : 2', type: U },
  ];
  // Text in parentheses, e.g. "Weapon Focus (Longsword)" -> "Longsword"
  const paren = name => { const m = String(name).match(/\(([^)]+)\)/); return m ? m[1].trim() : ''; };
  const note = (text) => [{ target: 'note', value: '', text, type: U }];

  // key: lower-case start of the feat name
  const FEATS = [
    ['toughness', () => [{ target: 'hp', value: 'max(3, level)', type: U }]],
    ['improved initiative', () => [{ target: 'init', value: 4, type: U }]],
    ['iron will', () => [{ target: 'will', value: 2, type: U }]],
    ['great fortitude', () => [{ target: 'fort', value: 2, type: U }]],
    ['lightning reflexes', () => [{ target: 'ref', value: 2, type: U }]],
    ['dodge', () => [{ target: 'ac', value: 1, type: 'Dodge (stacks)' }]],
    ['skill focus', n => [{ target: 'skill', skill: matchSkill(paren(n)), value: 'ranks >= 10 ? 6 : 3', type: U }]],
    ['alertness', () => skillPair('Perception', 'Sense Motive')],
    ['acrobatic', () => skillPair('Acrobatics', 'Fly')],
    ['athletic', () => skillPair('Climb', 'Swim')],
    ['deceitful', () => skillPair('Bluff', 'Disguise')],
    ['deft hands', () => skillPair('Disable Device', 'Sleight of Hand')],
    ['magical aptitude', () => skillPair('Spellcraft', 'Use Magic Device')],
    ['persuasive', () => skillPair('Diplomacy', 'Intimidate')],
    ['self-sufficient', () => skillPair('Heal', 'Survival')],
    ['stealthy', () => skillPair('Escape Artist', 'Stealth')],
    ['animal affinity', () => skillPair('Handle Animal', 'Ride')],
    ['greater weapon focus', n => [{ target: 'weapon', weapon: paren(n), value: 1, type: U }]],
    ['weapon focus', n => [{ target: 'weapon', weapon: paren(n), value: 1, type: U }]],
    ['greater weapon specialization', n => [{ target: 'weaponDmg', weapon: paren(n), value: 2, type: U }]],
    ['weapon specialization', n => [{ target: 'weaponDmg', weapon: paren(n), value: 2, type: U }]],
    ['shield focus', () => [{ target: 'ac', value: 1, type: U, text: 'Only while using a shield' }]],
    ['fleet', () => [{ target: 'speed', value: 5, type: U, text: 'Only in light or no armor' }]],
    ['point-blank shot', () => note('+1 attack and damage with ranged attacks within 30 ft.')],
    ['point blank shot', () => note('+1 attack and damage with ranged attacks within 30 ft.')],
    ['spell focus', n => note(`+1 to the save DC of ${paren(n) || 'that school'} spells`)],
    ['greater spell focus', n => note(`+1 more to the save DC of ${paren(n) || 'that school'} spells`)],
    ['combat casting', () => note('+4 on concentration checks to cast defensively or while grappled')],
    ['mobility', () => note('+4 dodge bonus to AC against attacks of opportunity from moving')],
    ['improved trip', () => note('+2 to trip attempts and +2 CMD against trip')],
    ['improved bull rush', () => note('+2 to bull rush attempts and +2 CMD against bull rush')],
    ['improved disarm', () => note('+2 to disarm attempts and +2 CMD against disarm')],
    ['improved grapple', () => note('+2 to grapple attempts and +2 CMD against grapple')],
    ['improved overrun', () => note('+2 to overrun attempts and +2 CMD against overrun')],
    ['improved sunder', () => note('+2 to sunder attempts and +2 CMD against sunder')],
    ['improved feint', () => note('Feint as a move action')],
    ['endurance', () => note('+4 on checks and saves listed under Endurance (forced march, holding breath, etc.)')],
    ['improved natural armor', () => [{ target: 'nat', value: 1, type: U }]],
    ['improved natural attack', () => note('Increase one natural attack\'s damage dice by one step (edit its dice)')],
    ['multiattack', () => note('Tick Multiattack on the Companion tab (secondary attacks -2 instead of -5)')],
    ['power attack', () => note('Switch on the Power Attack effect on the Play, Combat or Effects tab')],
    ['combat expertise', () => note('Switch on the Combat Expertise effect on the Play, Combat or Effects tab')],
    ['deadly aim', () => note('Switch on the Deadly Aim effect on the Play, Combat or Effects tab')],
    ['rapid shot', () => note('Switch on the Rapid Shot effect on the Play, Combat or Effects tab')],
  ];

  const TRAITS = [
    ['reactionary', () => [{ target: 'init', value: 2, type: 'Trait' }]],
    ['resilient', () => [{ target: 'fort', value: 1, type: 'Trait' }]],
    ['indomitable faith', () => [{ target: 'will', value: 1, type: 'Trait' }]],
    ['dangerously curious', () => [{ target: 'skill', skill: 'Use Magic Device', value: 1, type: 'Trait', text: 'Also a class skill: tick it on the Skills tab' }]],
    ['focused mind', () => note('+2 on concentration checks')],
    ['fate\'s favored', () => note('Luck bonuses you receive increase by 1')],
    ['magical lineage', () => note('One chosen spell counts as 1 level lower for metamagic')],
    ['courageous', () => note('+2 trait bonus on saves against fear')],
  ];

  // Magic items. "+N" in the name sets the bonus.
  const plus = (name, def) => { const m = String(name).match(/\+\s*(\d+)/); return m ? parseInt(m[1], 10) : def; };
  const E = 'Enhancement', C = 'Competence';
  const ab = (keys) => n => keys.map(k => ({ target: k, value: plus(n, 2), type: E }));
  const sk = (skills, val) => () => skills.map(s => ({ target: 'skill', skill: s, value: val, type: C }));
  const ITEMS = [
    ['belt of giant strength', ab(['str'])], ['belt of incredible dexterity', ab(['dex'])], ['belt of mighty constitution', ab(['con'])],
    ['belt of physical perfection', ab(['str', 'dex', 'con'])],
    ['belt of physical might', n => [{ target: 'str', value: plus(n, 2), type: E, text: 'Pick two of Str, Dex, Con' }, { target: 'con', value: plus(n, 2), type: E }]],
    ['headband of vast intelligence', ab(['int'])], ['headband of inspired wisdom', ab(['wis'])], ['headband of alluring charisma', ab(['cha'])],
    ['headband of mental superiority', ab(['int', 'wis', 'cha'])],
    ['headband of mental prowess', n => [{ target: 'int', value: plus(n, 2), type: E, text: 'Pick two of Int, Wis, Cha' }, { target: 'wis', value: plus(n, 2), type: E }]],
    ['cloak of resistance', n => [{ target: 'saves', value: plus(n, 1), type: 'Resistance' }]],
    ['ring of protection', n => [{ target: 'ac', value: plus(n, 1), type: 'Deflection' }]],
    ['amulet of natural armor', n => [{ target: 'nat', value: plus(n, 1), type: E }]],
    ['bracers of armor', n => [{ target: 'ac', value: plus(n, 1), type: 'Armor', text: "Doesn't stack with worn armor's armor bonus" }]],
    ['cloak of elvenkind', sk(['Stealth'], 5)], ['boots of elvenkind', sk(['Acrobatics'], 5)],
    ['eyes of the eagle', sk(['Perception'], 5)], ['goggles of minute seeing', sk(['Disable Device'], 5)],
    ['gloves of swimming and climbing', sk(['Swim', 'Climb'], 5)],
    ['vest of escape', () => [{ target: 'skill', skill: 'Disable Device', value: 4, type: C }, { target: 'skill', skill: 'Escape Artist', value: 6, type: C }]],
    ['boots of striding and springing', () => [{ target: 'speed', value: 10, type: E }, { target: 'note', value: '', type: C, text: '+5 competence bonus on Acrobatics checks to jump' }]],
    ['boots of speed', () => note('Haste as a free action for 10 rounds/day: switch on the Haste effect')],
    ['circlet of persuasion', () => note('+3 competence bonus on Charisma-based checks')],
    ['headband of ninjitsu', () => note('+2 competence bonus on Stealth; ki pool benefits')],
  ];

  // Eidolon evolutions (APG). Values are per selection; edit for repeated picks.
  const EVOLUTIONS = [
    ['improved natural armor', () => [{ target: 'nat', value: 2, type: U }]],
    ['ability increase', () => [{ target: 'str', value: 2, type: U, text: 'Pick the ability this applies to' }]],
    ['skilled', n => [{ target: 'skill', skill: matchSkill(paren(n)) || '', value: 8, type: 'Racial', text: 'Pick the skill' }]],
    ['resistance', n => note(`Resistance 5 to ${paren(n) || 'one energy type'} (increases by 5 per extra pick)`)],
    ['improved damage', n => note(`Increase ${paren(n) || 'one natural attack'}'s damage dice by one step`)],
    ['bite', () => note('Add a Bite attack on the Companion tab (1d6 for Medium, primary)')],
    ['claws', () => note('Add Claws (2 attacks, 1d4 for Medium, primary)')],
    ['slam', () => note('Add a Slam attack (1d8 for Medium, primary)')],
    ['pounce', () => note('Full attack after a charge')],
    ['reach', n => note(`+5 ft. reach with ${paren(n) || 'one attack'}`)],
    ['flight', () => note('Fly speed equal to base speed (average maneuverability)')],
    ['scent', () => note('Scent')],
    ['tail slap', () => note('Add a Tail Slap attack (secondary, 1d6 for Medium)')],
  ];

  let skillNames = [];
  function matchSkill(text) {
    const t = String(text || '').toLowerCase();
    if (!t) return '';
    const hit = skillNames.find(s => s.toLowerCase() === t) || skillNames.find(s => s.toLowerCase().startsWith(t.slice(0, 5)));
    return hit || text;
  }
  function lookup(list, name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    const hit = list.find(([key]) => n.startsWith(key));
    return hit ? hit[1] : null;
  }
  // Returns an array of bonuses for a feat/trait name, or null if unknown.
  function suggest(kind, name, skills) {
    skillNames = skills || [];
    const fn = lookup(kind === 'trait' ? TRAITS : kind === 'item' ? ITEMS : kind === 'evolution' ? EVOLUTIONS : FEATS, name);
    if (!fn) return null;
    return fn(name).map(b => Object.assign({ label: '', skill: '', weapon: '', text: '', active: true }, b));
  }

  window.PF_FEATS = { suggest };
})();
