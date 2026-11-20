// Character data model: defaults, migration, and shared constants.
(function () {
  'use strict';

  const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const ABILITY_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  const ABBR_TO_KEY = { Str: 'str', Dex: 'dex', Con: 'con', Int: 'int', Wis: 'wis', Cha: 'cha' };

  // Effect table columns, in the same order as the Autosheet's Effect Table.
  const EFFECT_COLS = [
    { key: 'ac', label: 'AC', group: 'Armor Class' },
    { key: 'nat', label: 'Nat', group: 'Armor Class' },
    { key: 'fort', label: 'Fort', group: 'Saves' },
    { key: 'ref', label: 'Ref', group: 'Saves' },
    { key: 'will', label: 'Will', group: 'Saves' },
    { key: 'str', label: 'Str', group: 'Abilities' },
    { key: 'dex', label: 'Dex', group: 'Abilities' },
    { key: 'con', label: 'Con', group: 'Abilities' },
    { key: 'int', label: 'Int', group: 'Abilities' },
    { key: 'wis', label: 'Wis', group: 'Abilities' },
    { key: 'cha', label: 'Cha', group: 'Abilities' },
    { key: 'mAtk', label: 'Atk', group: 'Melee' },
    { key: 'mDmg', label: 'Dmg', group: 'Melee' },
    { key: 'ohDmg', label: 'OHD', group: 'Melee', title: 'Off-hand damage' },
    { key: 'thDmg', label: '2HD', group: 'Melee', title: 'Two-handed damage' },
    { key: 'm1st', label: '1stA', group: 'Melee', title: 'Bonus on first melee attack only' },
    { key: 'rAtk', label: 'Atk', group: 'Ranged' },
    { key: 'rDmg', label: 'Dmg', group: 'Ranged' },
    { key: 'r1st', label: '1stA', group: 'Ranged', title: 'Bonus on first ranged attack only' },
    { key: 'cl', label: 'CL', group: 'Magic' },
    { key: 'twf', label: 'TWF', group: 'Extra Attacks', title: 'Off-hand attacks (Two-Weapon Fighting 1/2/3)' },
    { key: 'xMelee', label: 'Melee', group: 'Extra Attacks', title: 'Extra melee attacks at full bonus (e.g. Haste)' },
    { key: 'xRanged', label: 'Range', group: 'Extra Attacks', title: 'Extra ranged attacks at full bonus (e.g. Rapid Shot)' },
    { key: 'size', label: 'Size', group: 'Size', title: 'Relative size change in steps (+1 = one size larger)' },
    { key: 'speed', label: 'Base', group: 'Speed', title: 'Number adds; x0.5 multiplies' },
    { key: 'fly', label: 'Fly', group: 'Speed' },
    { key: 'swim', label: 'Swim', group: 'Speed' },
    { key: 'burrow', label: 'Burrow', group: 'Speed' },
    { key: 'climb', label: 'Climb', group: 'Speed' },
    { key: 'skills', label: 'All', group: 'Skills', title: 'Bonus to all skill checks' },
  ];

  const BONUS_TYPES = ['Alchemical', 'Armor', 'Circumstance (stacks)', 'Competence', 'Deflection', 'Dodge (stacks)', 'Enhancement',
    'Insight', 'Luck', 'Morale', 'Precision Damage', 'Racial', 'Resistance', 'Sacred / Profane', 'Size', 'Trait', 'Untyped (stacks)'];

  // What a bonus on a race, trait, feat or class feature can apply to.
  const BONUS_TARGETS = [
    { v: 'str', l: 'Strength' }, { v: 'dex', l: 'Dexterity' }, { v: 'con', l: 'Constitution' },
    { v: 'int', l: 'Intelligence' }, { v: 'wis', l: 'Wisdom' }, { v: 'cha', l: 'Charisma' },
    { v: 'skill', l: 'One skill…' }, { v: 'skills', l: 'All skills' },
    { v: 'saves', l: 'All saving throws' }, { v: 'fort', l: 'Fortitude' }, { v: 'ref', l: 'Reflex' }, { v: 'will', l: 'Will' },
    { v: 'ac', l: 'Armor Class' }, { v: 'nat', l: 'Natural armor' }, { v: 'cmd', l: 'CMD' },
    { v: 'hp', l: 'Max hit points' }, { v: 'init', l: 'Initiative' },
    { v: 'atk', l: 'All attack rolls' }, { v: 'mAtk', l: 'Melee attack' }, { v: 'rAtk', l: 'Ranged attack' },
    { v: 'dmg', l: 'All damage' }, { v: 'mDmg', l: 'Melee damage' }, { v: 'rDmg', l: 'Ranged damage' },
    { v: 'weapon', l: 'One weapon: attack' }, { v: 'weaponDmg', l: 'One weapon: damage' },
    { v: 'cmb', l: 'CMB' }, { v: 'cl', l: 'Caster level' }, { v: 'speed', l: 'Speed' },
    { v: 'note', l: 'Situational (note only)' },
  ];
  const STACKING_TYPES = ['Untyped (stacks)', 'Dodge (stacks)', 'Circumstance (stacks)'];

  const SIZES = [
    { key: 'F', name: 'Fine', atk: 8, cmb: -8, fly: 8, stealth: 16 },
    { key: 'D', name: 'Diminutive', atk: 4, cmb: -4, fly: 6, stealth: 12 },
    { key: 'T', name: 'Tiny', atk: 2, cmb: -2, fly: 4, stealth: 8 },
    { key: 'S', name: 'Small', atk: 1, cmb: -1, fly: 2, stealth: 4 },
    { key: 'M', name: 'Medium', atk: 0, cmb: 0, fly: 0, stealth: 0 },
    { key: 'L', name: 'Large', atk: -1, cmb: 1, fly: -2, stealth: -4 },
    { key: 'H', name: 'Huge', atk: -2, cmb: 2, fly: -4, stealth: -8 },
    { key: 'G', name: 'Gargantuan', atk: -4, cmb: 4, fly: -6, stealth: -12 },
    { key: 'C', name: 'Colossal', atk: -8, cmb: 8, fly: -8, stealth: -16 },
  ];

  const AGE = {
    categories: ['Young', 'Adult', 'Middle Age', 'Old', 'Venerable'],
    mods: {
      str: [-2, 0, -1, -3, -6], dex: [2, 0, -1, -3, -6], con: [-2, 0, -1, -3, -6],
      int: [0, 0, 1, 2, 3], wis: [-2, 0, 1, 2, 3], cha: [0, 0, 1, 2, 3],
    },
  };

  const XP = {
    tracks: ['Slow', 'Medium', 'Fast'],
    table: { // XP needed to reach level N (index N-1)
      Slow: [0, 3000, 7500, 14000, 23000, 35000, 53000, 77000, 115000, 160000, 235000, 330000, 475000, 665000, 955000, 1350000, 1900000, 2700000, 3850000, 5350000],
      Medium: [0, 2000, 5000, 9000, 15000, 23000, 35000, 51000, 75000, 105000, 155000, 220000, 315000, 445000, 635000, 890000, 1300000, 1800000, 2550000, 3600000],
      Fast: [0, 1300, 3300, 6000, 10000, 15000, 23000, 34000, 50000, 71000, 105000, 145000, 210000, 295000, 425000, 600000, 850000, 1200000, 1700000, 2400000],
    },
  };

  const HP_FORMULAS = ['Average', 'Average (1st level max)', 'Average round up', 'Average round up (1st level max)', 'Maximum', 'Custom Rolled'];
  const SKILL_SYSTEMS = ['Standard Skills', 'Background Skills', 'Consolidated Skills',
    'Ultimate Psionics (Autohypnosis + Kn. Psionics)', 'Ultimate Psionics + Background Skills'];
  const SPECIALTY_SKILLS = ['Artistry:', 'Craft:', 'Lore:', 'Perform:', 'Prof:'];
  const ITEM_SLOTS = ['head', 'headband', 'face/eyes', 'throat', 'shoulders', 'body', 'torso', 'arms', 'hands', 'waist', 'feet', 'ring', 'ring'];
  const BACKGROUND_QUESTIONS = [
    'How were you raised? Do you have any close family or friends?',
    'Where/From whom did you learn your skills?',
    'What are your personal life goals? What drives you?',
    'List your three most important personal values.',
    'What character flaw(s) is/are most likely to get you in trouble?',
    'What do you secretly fear, even in times of safety?',
  ];

  function blankEffect(name, type) {
    return { id: uid(), name: name || '', type: type || 'Untyped (stacks)', active: true, v: {}, text: '' };
  }

  // Combat quick toggles. `auto` marks values that the engine recomputes from BAB / speed.
  function defaultToggles() {
    return [
      { id: 'powerAttack', name: 'Power Attack', type: 'Untyped (stacks)', active: false, auto: 'powerAttack', v: {}, text: '' },
      { id: 'combatExpertise', name: 'Combat Expertise', type: 'Dodge (stacks)', active: false, auto: 'combatExpertise', v: {}, text: '' },
      { id: 'deadlyAim', name: 'Deadly Aim', type: 'Untyped (stacks)', active: false, auto: 'deadlyAim', v: {}, text: '' },
      { id: 'heroism', name: 'Heroism', type: 'Morale', active: false, v: { fort: 2, ref: 2, will: 2, mAtk: 2, rAtk: 2, skills: 2 }, text: 'Initiative +2' },
      { id: 'haste', name: 'Haste', type: 'Dodge (stacks)', active: false, auto: 'haste', v: { ac: 1, ref: 1, mAtk: 1, rAtk: 1, xMelee: 1, xRanged: 1 }, text: '' },
      { id: 'rapidShot', name: 'Rapid Shot', type: 'Untyped (stacks)', active: false, v: { rAtk: -2, xRanged: 1 }, text: '' },
      { id: 'studiedTarget', name: 'Studied Target', type: 'Untyped (stacks)', active: false, v: { mAtk: 1, mDmg: 1 }, text: '' },
      { id: 'custom8', name: '(Custom Effect 8)', type: 'Untyped (stacks)', active: false, v: {}, text: '' },
      { id: 'custom9', name: '(Custom Effect 9)', type: 'Untyped (stacks)', active: false, v: {}, text: '' },
      { id: 'custom10', name: '(Custom Effect 10)', type: 'Untyped (stacks)', active: false, v: {}, text: '' },
    ];
  }

  function blankWeapon() {
    return { name: '', mAtk: 0, mDmg: 0, enh: '0', category: '', formula: '', dice: '', crit: '20', mult: 'x2', range: '', type: '', dmgOverride: '' };
  }

  function blankCharacter() {
    const abil = {};
    ABILITIES.forEach(a => { abil[a] = { base: 10, enh: 0, inh: 0, pen: 0 }; });
    return {
      schema: 2,
      source: '',               // 'autosheet-xlsx' when imported from the Google Sheet
      id: uid(),
      info: {
        name: '', alignment: '', race: '', deity: '', player: '', gender: '', ageYears: '', height: '', weight: '',
        xpTrack: 'Medium', xp: 0, size: 'Medium', age: 'Adult', hpFormula: 'Average round up (1st level max)',
        speeds: { base: 30, fly: '', swim: '', burrow: '', climb: '' },
      },
      classes: [{ name: '', level: 0 }, { name: '', level: 0 }, { name: '', level: 0 }],
      fcb: { hp: 0, skills: 0, other: '' },
      race: {
        preset: '',
        abilityMods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        flex: false, flexAbility: '',   // "+2 to one ability score of your choice" (Human, Half-Elf, Half-Orc)
        skillRanksPerLevel: 0,          // e.g. Human "Skilled"
        senses: '',
        bonuses: [],                    // { label, target, skill, value, text, active }
      },
      rolledHp: ['', '', ''],   // per class, e.g. "8, 5, 6"
      abilities: abil,
      hp: { damage: 0, temp: 0, nonlethal: 0, dr: '', sr: '', resist: '' },
      saves: { fort: { misc: 0 }, ref: { misc: 0 }, will: { misc: 0 }, notes: '' },
      ac: { misc: 0, notes: '' },
      initiative: { misc: 0 },
      movement: { ignoreArmor: '', flight: 'Average', runMult: '', chargeBonus: 0, encumbrance: 'Light' },
      skills: {},          // name -> { ranks, misc }
      specialty: [         // Craft/Lore/Perform/Prof/Artistry rows
        { base: 'Craft:', detail: '', ranks: 0, misc: 0 },
        { base: 'Perform:', detail: '', ranks: 0, misc: 0 },
        { base: 'Prof:', detail: '', ranks: 0, misc: 0 },
      ],
      languages: '',
      weapons: [],
      attackNotes: '',
      armor: { name: '', item: '', material: '', enh: 0, mSkill: 0, mDex: 0 },
      shield: { name: '', item: '', material: '', enh: 0, mSkill: 0, mDex: 0 },
      armorNotes: '',
      magicItems: [],           // legacy; moved into effects by normalize()
      toggles: defaultToggles(),
      conditions: [],      // names from PF_DATA.conditions
      negativeLevels: 0,
      effects: [],
      spellcasting: {
        className: '', ability: 'wis', classLevelMisc: 0, clMisc: 0, notes: '',
        levels: Array.from({ length: 10 }, () => ({ spells: [], used: 0, perDayOverride: '' })),
        sla: [
          { label: '1/day', items: [] }, { label: '3/day', items: [] },
          { label: 'At will', items: [] }, { label: 'Constant', items: [] },
        ],
      },
      traits: [], racialFeatures: [], classFeatures: [], feats: [],
      notes: '',
      resources: [], heroPoints: { current: 0, max: 3 },
      slots: ITEM_SLOTS.map(s => ({ slot: s, item: '', bonuses: [] })),
      background: BACKGROUND_QUESTIONS.map(q => ({ q, a: '' })),
      settings: { skillSystem: 'Standard Skills', woundThresholds: false, minSkillRanks: false },
      companions: [],           // animal companions, eidolons, familiars, others (see companion.js)
      customClasses: [],        // classes copied from an imported workbook's Class Charts
      customAttackOptions: [],  // attack formulas copied from an imported workbook
    };
  }

  // Fill in any fields missing from older saves or imports.
  function normalize(ch) {
    const base = blankCharacter();
    function merge(target, defaults) {
      for (const k of Object.keys(defaults)) {
        if (target[k] === undefined || target[k] === null) target[k] = defaults[k];
        else if (isPlainObject(defaults[k]) && isPlainObject(target[k])) merge(target[k], defaults[k]);
      }
      return target;
    }
    merge(ch, base);
    while (ch.classes.length < 3) ch.classes.push({ name: '', level: 0 });
    // Schema 1 always kept six weapon slots (like the spreadsheet). Drop the empty ones once.
    if ((ch.schema || 1) < 2) { ch.weapons = ch.weapons.filter(w => !isBlankWeapon(w)); ch.schema = 2; }
    const have = new Set(ch.toggles.map(t => t.id));
    defaultToggles().forEach(t => { if (!have.has(t.id)) ch.toggles.push(t); });
    ch.effects.forEach(e => { if (!e.id) e.id = uid(); if (!e.v) e.v = {}; });
    migrateLegacyTypes(ch);
    magicItemsToEffects(ch);
    if (window.PF_COMPANION) ch.companions = (ch.companions || []).map(c => window.PF_COMPANION.normalize(c));
    for (const k of ['traits', 'feats', 'classFeatures', 'slots']) (ch[k] || []).forEach(x => { if (!Array.isArray(x.bonuses)) x.bonuses = []; });
    while (ch.spellcasting.levels.length < 10) ch.spellcasting.levels.push({ spells: [], used: 0, perDayOverride: '' });
    return ch;
  }

  // The Autosheet used one combined "Deflect/Enhance/Resist" type. Split it: AC -> Deflection,
  // saves -> Resistance, anything else -> Enhancement. A row touching several groups is split into several rows.
  const LEGACY = 'Deflect/Enhance/Resist';
  function legacyGroup(key) { return key === 'ac' ? 'Deflection' : (key === 'fort' || key === 'ref' || key === 'will') ? 'Resistance' : 'Enhancement'; }
  function migrateLegacyTypes(ch) {
    const out = [];
    for (const e of ch.effects) {
      if (e.type !== LEGACY) { out.push(e); continue; }
      const groups = {};
      for (const [k, val] of Object.entries(e.v || {})) (groups[legacyGroup(k)] = groups[legacyGroup(k)] || {})[k] = val;
      const types = Object.keys(groups);
      if (types.length <= 1) { e.type = types[0] || 'Enhancement'; out.push(e); continue; }
      types.forEach((t, i) => out.push(Object.assign({}, e, { id: i === 0 ? e.id : uid(), type: t, v: groups[t], text: i === 0 ? e.text : '' })));
    }
    ch.effects = out;
    for (const t of ch.toggles) {
      if (t.type !== LEGACY) continue;
      const keys = Object.keys(t.v || {});
      t.type = keys.some(k => ['fort', 'ref', 'will'].includes(k)) ? 'Resistance' : keys.includes('ac') ? 'Deflection' : 'Enhancement';
    }
    for (const m of ch.magicItems) {
      if (m.type === LEGACY || !m.type) m.type = m.target === 'AC' ? 'Deflection' : m.target === 'NatAC' ? 'Enhancement' : 'Resistance';
    }
  }

  // The spreadsheet had a small "Magic Item or Feature" block (Saves / AC / NatAC). Those are ordinary
  // effects, so they live on the Effects tab: move any into ch.effects.
  function magicItemsToEffects(ch) {
    const keep = [];
    for (const m of ch.magicItems || []) {
      const val = typeof m.value === 'number' ? m.value : parseFloat(m.value);
      if (!m.name && !Number.isFinite(val)) continue;
      if (!Number.isFinite(val)) { keep.push(m); continue; }
      const v = m.target === 'AC' ? { ac: val } : m.target === 'NatAC' ? { nat: val } : { fort: val, ref: val, will: val };
      ch.effects.push({ id: uid(), name: m.name || 'Magic item', type: m.type || 'Resistance', active: m.active !== false, v, text: '' });
    }
    ch.magicItems = keep.filter(m => m.name);
  }

  function isBlankWeapon(w) { return !w || (!String(w.name || '').trim() && !w.formula && !String(w.dmgOverride || '').trim()); }

  function isPlainObject(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function uid() { return Math.random().toString(36).slice(2, 10); }

  window.PF_MODEL = {
    ABILITIES, ABILITY_NAMES, ABBR_TO_KEY, EFFECT_COLS, BONUS_TYPES, BONUS_TARGETS, STACKING_TYPES, SIZES, AGE, XP,
    HP_FORMULAS, SKILL_SYSTEMS, SPECIALTY_SKILLS, ITEM_SLOTS, BACKGROUND_QUESTIONS,
    blankCharacter, blankEffect, blankWeapon, isBlankWeapon, defaultToggles, normalize, uid,
  };
})();
