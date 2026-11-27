// Race presets: the seven core races by hand, plus the Advanced Race Guide races from data/srd/races.json. Applying one fills the Race tab; everything stays editable.
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

  const BONUS_TARGETS = window.PF_MODEL.BONUS_TARGETS;

  // Advanced Race Guide races from the rules data (data/srd/races.json), in the same shape as the presets above.
  // The core seven keep their hand-made presets.
  function fromSrd(x) {
    return {
      size: x.size, speed: x.speed, slowAndSteady: !!x.slow, abilityMods: x.mods || {}, flex: !!x.flex, senses: x.senses || '',
      languages: x.languages || '', skillRanksPerLevel: x.ranks || 0, speeds: x.speeds || {}, cat: x.cat, source: x.s,
      bonuses: (x.bonuses || []).map(b => Object.assign({}, b)), features: (x.features || []).map(f => f.slice()),
    };
  }
  function srdCache() { return (window.PF_SRD._racesList = window.PF_SRD._racesList || []); }
  const key = s => String(s || '').toLowerCase().replace(/\s*\(.*\)\s*$/, '').trim();
  // Find a race by name: "Human", "human", "Human (Varisian)", "Tieflings", "half orc"
  function find(name) {
    const k = key(name).replace(/\s+/g, '-');
    const core = Object.keys(RACES).find(n => n.toLowerCase() === k || n.toLowerCase() + 's' === k || (k === 'dwarves' && n === 'Dwarf') || (k === 'elves' && n === 'Elf') || (k === 'half-elves' && n === 'Half-Elf'));
    if (core) return { name: core, preset: RACES[core] };
    const srd = srdCache().find(x => x.n.toLowerCase() === k || x.n.toLowerCase() + 's' === k || x.n.toLowerCase().replace(/\s+/g, '-') === k);
    return srd ? { name: srd.n, preset: fromSrd(srd) } : null;
  }
  // Names for the Race tab, grouped
  function groups() {
    const extra = srdCache().filter(x => !RACES[x.n]);
    return [['Core', Object.keys(RACES)], ['Featured', extra.filter(x => x.cat === 'featured').map(x => x.n)], ['Uncommon', extra.filter(x => x.cat !== 'featured').map(x => x.n)]].filter(g => g[1].length);
  }
  // Loads the rules-data races once; resolves when find()/groups() can see them
  function load() {
    if (!window.PF_SRD) return Promise.resolve();
    return window.PF_SRD.load('races').then(c => { if (c) window.PF_SRD._racesList = c.list; });
  }

  window.PF_RACES = { RACES, BONUS_TARGETS, find, groups, load, loaded: () => !!(window.PF_SRD && window.PF_SRD._racesList) };
})();
