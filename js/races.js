// Core Rulebook race presets. Applying one fills the Race tab; everything stays editable.
// Bonus targets: saves, fort, ref, will, ac, nat, atk, mAtk, rAtk, init, skill (with `skill`), skills, cl, note (situational, no math).
(function () {
  'use strict';
  const RACES = {
    Dwarf: {
      size: 'Medium', speed: 20, slowAndSteady: true,
      abilityMods: { con: 2, wis: 2, cha: -2 },
      senses: 'Darkvision 60 ft.', languages: 'Common, Dwarven',
      bonuses: [
        { label: 'Defensive Training', target: 'note', value: 4, text: '+4 dodge bonus to AC against monsters of the giant subtype' },
        { label: 'Greed', target: 'note', value: 2, text: '+2 Appraise to determine the price of nonmagical goods containing precious metals or gemstones' },
        { label: 'Hatred', target: 'note', value: 1, text: '+1 on attack rolls against humanoids of the orc and goblinoid subtypes' },
        { label: 'Hardy', target: 'note', value: 2, text: '+2 on saving throws against poison, spells, and spell-like abilities' },
        { label: 'Stability', target: 'note', value: 4, text: '+4 to CMD against bull rush or trip while standing on the ground' },
        { label: 'Stonecunning', target: 'note', value: 2, text: '+2 Perception to notice unusual stonework; automatic check within 10 ft.' },
      ],
      features: [
        ['Slow and Steady', 'Base speed 20 ft., never modified by armor or encumbrance.'],
        ['Darkvision', 'See in the dark up to 60 feet.'],
        ['Weapon Familiarity', 'Proficient with battleaxes, heavy picks, and warhammers; "dwarven" weapons are martial weapons.'],
      ],
    },
    Elf: {
      size: 'Medium', speed: 30,
      abilityMods: { dex: 2, int: 2, con: -2 },
      senses: 'Low-light vision', languages: 'Common, Elven',
      bonuses: [
        { label: 'Keen Senses', target: 'skill', skill: 'Perception', value: 2 },
        { label: 'Elven Immunities', target: 'note', value: 2, text: 'Immune to magic sleep effects; +2 on saves against enchantment spells and effects' },
        { label: 'Elven Magic', target: 'note', value: 2, text: '+2 on caster level checks to overcome spell resistance; +2 Spellcraft to identify magic item properties' },
      ],
      features: [
        ['Low-Light Vision', 'See twice as far as humans in dim light.'],
        ['Weapon Familiarity', 'Proficient with longbows, longswords, rapiers, and shortbows; "elven" weapons are martial weapons.'],
      ],
    },
    Gnome: {
      size: 'Small', speed: 20,
      abilityMods: { con: 2, cha: 2, str: -2 },
      senses: 'Low-light vision', languages: 'Common, Gnome, Sylvan',
      bonuses: [
        { label: 'Keen Senses', target: 'skill', skill: 'Perception', value: 2 },
        { label: 'Defensive Training', target: 'note', value: 4, text: '+4 dodge bonus to AC against monsters of the giant subtype' },
        { label: 'Hatred', target: 'note', value: 1, text: '+1 on attack rolls against humanoids of the reptilian and goblinoid subtypes' },
        { label: 'Illusion Resistance', target: 'note', value: 2, text: '+2 on saving throws against illusion spells and effects' },
        { label: 'Obsessive', target: 'note', value: 2, text: '+2 on a Craft or Profession skill of your choice (add it on the Skills tab as Misc)' },
      ],
      features: [
        ['Gnome Magic', '+1 to the DC of illusion spells you cast. With Cha 11+: dancing lights, ghost sound, prestidigitation, speak with animals 1/day each (CL = level).'],
        ['Low-Light Vision', 'See twice as far as humans in dim light.'],
        ['Weapon Familiarity', '"Gnome" weapons are martial weapons.'],
      ],
    },
    'Half-Elf': {
      size: 'Medium', speed: 30, flex: true,
      abilityMods: {},
      senses: 'Low-light vision', languages: 'Common, Elven',
      bonuses: [
        { label: 'Keen Senses', target: 'skill', skill: 'Perception', value: 2 },
        { label: 'Elven Immunities', target: 'note', value: 2, text: 'Immune to magic sleep effects; +2 on saves against enchantment spells and effects' },
      ],
      features: [
        ['Adaptability', 'Skill Focus as a bonus feat at 1st level.'],
        ['Elf Blood', 'Count as both elves and humans for any effect related to race.'],
        ['Multitalented', 'Choose two favored classes at 1st level.'],
        ['Low-Light Vision', 'See twice as far as humans in dim light.'],
      ],
    },
    'Half-Orc': {
      size: 'Medium', speed: 30, flex: true,
      abilityMods: {},
      senses: 'Darkvision 60 ft.', languages: 'Common, Orc',
      bonuses: [
        { label: 'Intimidating', target: 'skill', skill: 'Intimidate', value: 2 },
      ],
      features: [
        ['Orc Ferocity', 'Once per day, when brought below 0 hit points but not killed, fight on for one more round as if disabled.'],
        ['Orc Blood', 'Count as both orcs and humans for any effect related to race.'],
        ['Darkvision', 'See in the dark up to 60 feet.'],
        ['Weapon Familiarity', 'Proficient with greataxes and falchions; "orc" weapons are martial weapons.'],
      ],
    },
    Halfling: {
      size: 'Small', speed: 20,
      abilityMods: { dex: 2, cha: 2, str: -2 },
      senses: '', languages: 'Common, Halfling',
      bonuses: [
        { label: 'Halfling Luck', target: 'saves', value: 1 },
        { label: 'Keen Senses', target: 'skill', skill: 'Perception', value: 2 },
        { label: 'Sure-Footed', target: 'skill', skill: 'Acrobatics', value: 2 },
        { label: 'Sure-Footed', target: 'skill', skill: 'Climb', value: 2 },
        { label: 'Fearless', target: 'note', value: 2, text: '+2 on saving throws against fear (stacks with Halfling Luck)' },
      ],
      features: [
        ['Weapon Familiarity', 'Proficient with slings; "halfling" weapons are martial weapons.'],
      ],
    },
    Human: {
      size: 'Medium', speed: 30, flex: true, skillRanksPerLevel: 1,
      abilityMods: {},
      senses: '', languages: 'Common',
      bonuses: [],
      features: [
        ['Bonus Feat', 'One extra feat at 1st level.'],
        ['Skilled', 'One additional skill rank at first level and one more each level (counted automatically).'],
      ],
    },
  };

  const BONUS_TARGETS = [
    { v: 'saves', l: 'All saving throws' }, { v: 'fort', l: 'Fortitude' }, { v: 'ref', l: 'Reflex' }, { v: 'will', l: 'Will' },
    { v: 'ac', l: 'Armor Class' }, { v: 'nat', l: 'Natural armor' },
    { v: 'atk', l: 'Attack rolls' }, { v: 'mAtk', l: 'Melee attack' }, { v: 'rAtk', l: 'Ranged attack' },
    { v: 'init', l: 'Initiative' }, { v: 'skill', l: 'One skill…' }, { v: 'skills', l: 'All skills' }, { v: 'cl', l: 'Caster level' },
    { v: 'note', l: 'Situational (note only)' },
  ];

  window.PF_RACES = { RACES, BONUS_TARGETS };
})();
