// Third-party classes that aren't in the Autosheet's Class Charts (Open Game Content, see OGL.txt).
// Each one is appended to PF_DATA.classes and PF_DATA.classSkills (data.js stays a straight copy of the spreadsheet).
// Their class features, choices, archetypes and new spells are in data/3pp/*.json (loaded with the SRD data).
(function () {
  'use strict';
  const D = window.PF_DATA;
  const row = (...per) => [null].concat(per, [null, null, null]).slice(0, 10);   // spells per day, levels 0-9

  const CLASSES = [
    // Classes of NeoExodus: Machinesmith (Louis Porter Jr. Design). Prototypes work like prepared spells from a
    // blueprint book (as a wizard's spellbook), Intelligence-based, 1st to 6th level, no 0-level prototypes.
    {
      cat: '3PP-Martial', name: 'Machinesmith', hd: 8, bab: 0.75, fort: 'Good', ref: 'Good', will: 'Poor', skills: 4, stat: 'INT',
      known: 'Spellbook', source: 'Classes of NeoExodus: Machinesmith',
      perDayTable: [
        row(1), row(2), row(3), row(3, 1), row(4, 2), row(4, 3), row(4, 3, 1), row(4, 4, 2), row(5, 4, 3), row(5, 4, 3, 1),
        row(5, 4, 4, 2), row(5, 5, 4, 3), row(5, 5, 4, 3, 1), row(5, 5, 4, 4, 2), row(5, 5, 5, 4, 3), row(5, 5, 5, 4, 3, 1),
        row(5, 5, 5, 4, 4, 2), row(5, 5, 5, 5, 4, 3), row(5, 5, 5, 5, 5, 4), row(5, 5, 5, 5, 5, 5),
      ],
      // Appraise, Craft, Disable Device, Fly, Knowledge (arcana, dungeoneering, engineering, geography, nature, planes),
      // Perception, Profession, Spellcraft, Use Magic Device (plus the background and consolidated skill equivalents)
      classSkills: ['Appraise', 'Artistry:', 'C. Acrobatics', 'C. Finesse', 'C. Nature', 'C. Perception', 'C. Spellcraft', 'Craft:', 'Disable Device', 'Fly',
        'Kn. Arcana', 'Kn. Dungeoneering', 'Kn. Engineering', 'Kn. Geography', 'Kn. Nature', 'Kn. Planes', 'Lore:', 'Perception', 'Prof:', 'Spellcraft', 'Use Magic Device'],
    },
  ];

  for (const c of CLASSES) {
    if (D.classes.some(x => x.name === c.name)) continue;
    D.classes.push(c);
    D.classSkills[c.name] = c.classSkills;
  }
  window.PF_3PP = { classes: CLASSES.map(c => c.name) };
})();
