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
    ['power attack', () => note('Use the Power Attack toggle on the Play or Combat tab')],
    ['combat expertise', () => note('Use the Combat Expertise toggle on the Play or Combat tab')],
    ['deadly aim', () => note('Use the Deadly Aim toggle on the Play or Combat tab')],
    ['rapid shot', () => note('Use the Rapid Shot toggle on the Play or Combat tab')],
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
    const fn = lookup(kind === 'trait' ? TRAITS : FEATS, name);
    if (!fn) return null;
    return fn(name).map(b => Object.assign({ label: '', skill: '', weapon: '', text: '', active: true }, b));
  }

  window.PF_FEATS = { suggest };
})();
