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
  // Situational bonus: real numbers, but off until you switch it on (Play tab, Situational chips)
  const sit = (target, value, type, text, extra) => Object.assign({ target, value, type: type || U, text: text || '', situational: true, active: false }, extra || {});

  // Improved <maneuver>: +2 CMB to do it, +2 CMD against it. Switch on while it's happening.
  const maneuver = m => [sit('cmb', 2, U, `${m} only`), sit('cmd', 2, U, `Against ${m} only`)];

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
    ['point-blank shot', () => [sit('rAtk', 1, U, 'Ranged attacks within 30 ft.'), sit('rDmg', 1, U, 'Ranged attacks within 30 ft.')]],
    ['point blank shot', () => [sit('rAtk', 1, U, 'Ranged attacks within 30 ft.'), sit('rDmg', 1, U, 'Ranged attacks within 30 ft.')]],
    ['cleave', () => [sit('ac', -2, U, 'Until your next turn after using Cleave')]],
    ['lunge', () => [sit('ac', -2, U, 'Until your next turn after using Lunge')]],
    ['two-weapon defense', () => [sit('ac', 1, 'Untyped (stacks)', 'Shield bonus while wielding two weapons (+2 when fighting defensively)')]],
    ['spell focus', n => note(`+1 to the save DC of ${paren(n) || 'that school'} spells`)],
    ['greater spell focus', n => note(`+1 more to the save DC of ${paren(n) || 'that school'} spells`)],
    ['combat casting', () => note('+4 on concentration checks to cast defensively or while grappled')],
    ['mobility', () => [sit('ac', 4, 'Dodge (stacks)', 'Against attacks of opportunity from moving out of or within a threatened area')]],
    ['improved trip', () => maneuver('trip')],
    ['improved bull rush', () => maneuver('bull rush')],
    ['improved disarm', () => maneuver('disarm')],
    ['improved grapple', () => maneuver('grapple')],
    ['improved overrun', () => maneuver('overrun')],
    ['improved sunder', () => maneuver('sunder')],
    ['improved dirty trick', () => maneuver('dirty trick')],
    ['improved drag', () => maneuver('drag')],
    ['improved reposition', () => maneuver('reposition')],
    ['improved steal', () => maneuver('steal')],
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
    ['deft dodger', () => [{ target: 'ref', value: 1, type: 'Trait' }]],
    ['indomitable faith', () => [{ target: 'will', value: 1, type: 'Trait' }]],
    ['dangerously curious', () => [{ target: 'skill', skill: 'Use Magic Device', value: 1, type: 'Trait', text: 'Also a class skill: tick it on the Skills tab' }]],
    ['focused mind', () => note('+2 on concentration checks')],
    ['fate\'s favored', () => note('Luck bonuses you receive increase by 1')],
    ['magical lineage', () => note('One chosen spell counts as 1 level lower for metamagic')],
    ['courageous', () => [sit('saves', 2, 'Trait', 'Against fear')]],
    ['birthmark', () => [sit('saves', 2, 'Trait', 'Against charm and compulsion effects')]],
    ['shield-trained', () => note('Shield proficiency or armor check penalty reduced for shields')],
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
  // Class features: numbers where the feature always applies, reminders where it's situational.
  // `cls` is the class slug (paladin, monk...), for features that differ by class.
  const FEATURES = [
    ['divine grace', () => [{ target: 'saves', value: 'max(0, cha)', type: U }]],
    // Holy vindicator stigmata: a sacred bonus of half the vindicator level to one thing at a time (switched on at the table)
    ...[['ac', 'ac', 'AC'], ['attack rolls', 'atk', 'attack rolls'], ['saving throws', 'saves', 'saving throws'], ['weapon damage', 'dmg', 'weapon damage']].map(([k, t, what]) =>
      [`stigmata: ${k}`, (n, cls) => [sit(t, `max(1, floor(${cls || 'holy_vindicator'} / 2))`, 'Sacred / Profane', `Stigmata on ${what}: bleeding, you gain a sacred bonus of half your vindicator level (one stigmata at a time)`)]]),
    ['stigmata: caster level checks', () => [sit('note', '', 'Sacred / Profane', 'Stigmata on caster level checks: a sacred bonus of half your vindicator level on caster level checks and concentration (one stigmata at a time)')]],
    ['unholy resilience', () => [{ target: 'saves', value: 'max(0, cha)', type: U }]],
    ['nature sense', () => [{ target: 'skill', skill: 'Kn. Nature', value: 2, type: U }, { target: 'skill', skill: 'Survival', value: 2, type: U }]],
    ['fast movement', (n, cls) => cls === 'monk'
      ? [{ target: 'speed', value: 'floor(monk/3)*10', type: U, text: 'Only without armor or a medium/heavy load' }]
      : [{ target: 'speed', value: 10, type: U, text: 'Not in heavy armor or with a heavy load' }]],
    ['bravery', (n, cls) => [sit('will', `max(1, floor((${cls || 'fighter'} + 2) / 4))`, U, 'Against fear')]],
    ['crafter', (n, cls) => [{ target: 'skill', skill: 'Craft:', value: `max(1, floor(${cls || 'machinesmith'} / 2))`, type: U }]],
    ['trapfinding', (n, cls) => note(`+1/2 ${cls || 'rogue'} level (min +1) on Perception to find traps and on Disable Device`)],
    ['trap sense', (n, cls) => [sit('ref', `max(1, floor(${cls || 'rogue'} / 3))`, U, 'Against traps'), sit('ac', `max(1, floor(${cls || 'rogue'} / 3))`, 'Dodge (stacks)', 'Against traps')]],
    ['danger sense', () => note('Bonus on Reflex saves and AC against traps, and on Perception to avoid surprise')],
    ['evasion', () => note('Successful Reflex save for half damage: take none instead (light or no armor)')],
    ['improved evasion', () => note('Failed Reflex save for half damage: take only half')],
    ['uncanny dodge', () => note('Not flat-footed when surprised or against invisible attackers')],
    ['improved uncanny dodge', () => note('Can\'t be flanked except by a rogue 4+ levels higher')],
    ['sneak attack', () => note('Extra damage when flanking or the target is denied its Dex bonus')],
    ['track', (n, cls) => note(`+1/2 ${cls || 'ranger'} level on Survival to follow tracks`)],
    ['wild empathy', () => note('Improve an animal\'s attitude like Diplomacy (1d20 + level + Cha)')],
    ['favored enemy', () => [sit('atk', 2, U, 'Against your favored enemy (raise it for a higher-bonus enemy)'), sit('dmg', 2, U, 'Against your favored enemy'),
      { target: 'note', value: '', type: U, text: 'Favored enemy also adds its bonus on Bluff, Knowledge, Perception, Sense Motive and Survival checks against them' }]],
    ['favored terrain', () => [sit('init', 2, U, 'In your favored terrain (raise it for a higher-bonus terrain)'),
      { target: 'note', value: '', type: U, text: 'Favored terrain also adds its bonus on Kn. Geography, Perception, Stealth and Survival there' }]],
    ['armor training', () => note('Lower armor check penalty and higher max Dex in armor (set on the Combat tab)')],
    ['weapon training', () => note('Bonus on attack and damage with the chosen weapon groups (add as a weapon bonus)')],
    ['channel energy', () => note('Channel positive or negative energy: dice heal or harm in a 30-ft. burst')],
    ['channel positive energy', () => note('Channel positive energy: dice heal or harm in a 30-ft. burst')],
    ['lay on hands', () => note('Heal 1d6 per 2 paladin levels as a standard action (swift on yourself)')],
    ['still mind', () => [sit('saves', 2, U, 'Against enchantment spells and effects')]],
    ['divine health', () => note('Immune to diseases')],
    ['aura of courage', () => note('Immune to fear; allies within 10 ft. get +4 morale on saves against fear')],
    ['aura of resolve', () => note('Immune to charm; allies within 10 ft. get +4 morale on saves against charm')],
    ['resist nature', () => [sit('saves', 4, U, 'Against the spell-like and supernatural abilities of fey')]],
    ['woodland stride', () => note('Move through natural undergrowth at normal speed without harm')],
    ['poison resistance', () => note('Bonus on saves against poison')],
    ['stalwart', () => note('Successful Fortitude or Will save for a partial effect: no effect instead')],
    ['mettle', () => note('Successful Fortitude or Will save for a partial effect: no effect instead')],
    ['inspire courage', (n, cls) => { const v = `floor((${cls || 'bard'} + 1) / 6) + 1`; return [sit('atk', v, 'Competence', 'While you perform Inspire Courage'), sit('dmg', v, 'Competence', 'Weapon damage'), sit('saves', v, 'Morale', 'Against charm and fear')]; }],
    ['bane', (n, cls) => [sit('atk', 2, U, 'Weapon is bane against the chosen creature type'), sit('dmg', 2, U, 'Plus 2d6 damage against that creature type (add it to the roll)')]],
    ['challenge', (n, cls) => [sit('dmg', cls || 'cavalier', U, 'Melee damage against the target of your challenge'), sit('ac', -2, U, 'Against attacks from anyone other than your challenge target')]],
    ['studied target', (n, cls) => { const v = `floor(${cls || 'slayer'} / 5) + 1`; return [sit('atk', v, U, 'Against your studied target'), sit('dmg', v, U, 'Against your studied target')]; }],
    ['bardic knowledge', (n, cls) => note(`+1/2 ${cls || 'bard'} level on all Knowledge checks; can make them untrained`)],
  ];

  function lookup(list, name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    const hit = list.find(([key]) => n.startsWith(key));
    return hit ? hit[1] : null;
  }
  // ----- Situational bonuses read from rules text
  // "+2 on saving throws against poison" -> a saves +2 bonus that's off until switched on. Used for race traits
  // and for feats, traits and class features that have no hand-made entry above.
  const TYPE_WORDS = { alchemical: 'Alchemical', circumstance: 'Circumstance (stacks)', competence: 'Competence', deflection: 'Deflection', dodge: 'Dodge (stacks)',
    enhancement: 'Enhancement', insight: 'Insight', luck: 'Luck', morale: 'Morale', racial: 'Racial', resistance: 'Resistance', sacred: 'Sacred / Profane',
    profane: 'Sacred / Profane', trait: 'Trait', untyped: U, shield: U, armor: 'Armor', size: 'Size' };
  const TARGET_RES = [
    [/^melee attack (?:rolls )?and (?:weapon )?damage/, ['mAtk', 'mDmg']], [/^ranged attack (?:rolls )?and (?:weapon )?damage/, ['rAtk', 'rDmg']],
    [/^attack (?:rolls )?and (?:weapon )?damage/, ['atk', 'dmg']], [/^melee attack/, ['mAtk']], [/^ranged attack/, ['rAtk']], [/^attack rolls?/, ['atk']],
    [/^(?:weapon )?damage rolls?/, ['dmg']], [/^(?:saving throws?|saves)\b/, ['saves']], [/^fortitude/, ['fort']], [/^reflex/, ['ref']], [/^will (?:saves?|saving)/, ['will']],
    [/^(?:ac|armor class)\b/, ['ac']], [/^(?:cmd|combat maneuver defense)\b/, ['cmd']], [/^(?:cmb|combat maneuver checks?)\b/, ['cmb']], [/^initiative/, ['init']],
  ];
  function allSkillNames() {
    const D = window.PF_DATA;
    return (skillNames.length ? skillNames : Object.keys((D && D.skillMeta) || {})).filter(s => !/:$/.test(s));
  }
  function skillAt(rest) {
    const r = rest.replace(/^knowledge \((\w+)\)/, 'kn. $1');
    return allSkillNames().sort((a, b) => b.length - a.length).find(s => r.startsWith(s.toLowerCase()) && !/^\w/.test(r.slice(s.length))) || '';
  }
  // picks: skills chosen in the name ("Vagabond Child (urban, Sleight of Hand)"), for "a +1 trait bonus on that skill"
  function detect(text, defType, label, picks) {
    picks = picks || [];
    const out = [];
    const src = String(text || '');
    // One clause at a time, so the reminder text is the sentence the number came from
    // (no regex lookbehind: older Safari can't parse it, and the whole file would fail to load)
    for (const clause of src.replace(/([.;])\s+/g, '$1\n').split(/\n+/)) {
      const re = /\+(\d+)\s+(?:([a-z]+)\s+)?(?:bonus(?:es)?\s+)?(?:(?:on|to|in|with)\s+)?(?:all\s+|your\s+|its\s+|his or her\s+|their\s+)?/gi;
      let m;
      while ((m = re.exec(clause))) {
        const val = +m[1];
        let word = (m[2] || '').toLowerCase(), type = TYPE_WORDS[word];
        let rest = clause.slice(m.index + m[0].length).toLowerCase();
        // "+2 Perception to notice..." / "+4 racial bonus on Stealth": the word after the number may be a skill, not a type
        if (!type && word && !/^(bonus|on|to|in|with)$/.test(word)) rest = (word + ' ' + clause.slice(m.index + m[0].length)).toLowerCase().replace(/^(\w+) (?:bonus(?:es)? )?(?:on |to )?/, (x, w) => w + ' ');
        rest = rest.replace(/knowledge \((\w+)\)/g, 'kn. $1');
        let targets = null, skills = [], after = '';
        for (const [r, t] of TARGET_RES) { const hit = rest.match(r); if (hit) { targets = t; after = rest.slice(hit[0].length); break; } }
        // "on that skill" / "the chosen skill": the skill picked in the name
        const that = !targets && picks.length && rest.match(/^(?:that|this|the chosen|the selected) skill(?:\s+checks?)?/);
        if (that) { targets = ['skill']; skills = [picks[0]]; after = rest.slice(that[0].length); }
        if (!targets) {
          // One skill or a list: "Perception and Stealth checks", "Bluff, Diplomacy, or Sense Motive"
          const head = rest.split(/\s+(?:skill\s+)?checks?\b/)[0];
          skills = head.split(/,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/).map(x => skillAt(x.trim())).filter(Boolean);
          if (!skills.length) { const one = skillAt(rest); if (one) skills = [one]; }
          // "Diplomacy, Knowledge (local), or Sense Motive (choose one)": only the one picked in the name
          const chosen = skills.length > 1 ? skills.filter(x => picks.includes(x)) : [];
          if (chosen.length) skills = chosen;
          if (skills.length) {
            targets = ['skill'];
            const last = skills[skills.length - 1].toLowerCase(), at = rest.indexOf(last);
            after = at >= 0 ? rest.slice(at + last.length).replace(/^\s*(?:skill\s+)?checks?\b/, '') : '';
          }
        }
        if (!targets) continue;
        // No condition after the target ("+2 dodge bonus to Armor Class.") means it always applies
        // (only the words right after it count: in "... on Intimidate checks, and Intimidate is always a class skill for you"
        // the second half isn't a condition)
        const cond = after.split(/[,;]|\band\b/)[0];
        const always = !/\b(against|when|whenever|while|within|made|during|if|vs|versus|in|to|for|that|until|near|from|with|by|as|on|at|of)\b/.test(cond);
        const why = clause.trim().replace(/\s+/g, ' ');
        const make = (t, extra) => Object.assign(sit(t, val, type || defType || U, why), always ? { situational: false, active: true } : {}, extra || {}, label ? { label } : {});
        if (targets[0] === 'skill') skills.forEach(sk => out.push(make('skill', { skill: sk })));
        else for (const t of targets) out.push(make(t));
      }
    }
    return out;
  }

  // Returns an array of bonuses for a feat/trait name, or null if unknown.
  // `text`: the rules text, read for situational bonuses when the name has no hand-made entry.
  function suggest(kind, name, skills, cls, text) {
    skillNames = skills || [];
    const list = kind === 'trait' ? TRAITS : kind === 'item' ? ITEMS : kind === 'evolution' ? EVOLUTIONS : kind === 'feature' ? FEATURES : FEATS;
    // Class features: compare without trailing numbers or details ("Fast movement +10" -> "fast movement")
    const nm = kind === 'feature' ? String(name || '').toLowerCase().replace(/\s*[+\u2212-]?\d.*$/, '').replace(/\s*\(.*$/, '').trim() : name;
    const fn = kind === 'feature' ? (FEATURES.find(([k]) => nm === k) || [])[1] : lookup(list, name);
    const fill = b => Object.assign({ label: '', skill: '', weapon: '', text: '', active: true }, b);
    if (!fn) {
      if (!text || kind === 'item' || kind === 'evolution') return null;
      const picks = String((String(name || '').match(/\(([^)]*)\)\s*$/) || [])[1] || '').split(/,\s*/).map(x => skillAt(x.trim().toLowerCase())).filter(Boolean);
      const found = detect(text, kind === 'trait' ? 'Trait' : U, undefined, picks);
      return found.length ? found.map(fill) : null;
    }
    return fn(name, cls).map(fill);
  }

  window.PF_FEATS = { suggest, detect };
})();
