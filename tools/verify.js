// Usage: python tools/dump_cells.py Character.xlsx cells.json && node tools/verify.js cells.json
// Imports the character and compares computed values with the values cached in the spreadsheet.
const path = require("path").resolve(process.argv[2]), app = require("path").resolve(__dirname, "..");
global.window = {};
for (const f of ['data', 'attacks-extra', 'model', 'companion', 'races', 'feats', 'engine', 'import']) require(app + '/js/' + f + '.js');
const cells = require(path);
const book = { v: (sh, a) => (cells[sh] && cells[sh].v[a] !== undefined ? cells[sh].v[a] : ""), f: (sh, a) => (cells[sh] && cells[sh].f[a]) || "", maxRow: sh => cells[sh] ? cells[sh].max : 0 };
const main = a => book.v("Main Sheet", a);
const { character: ch, warnings } = window.PF_IMPORT.importAutosheet(book);
const d = window.PF_ENGINE.compute(ch);
const checks = [];
const eq = (label, mine, cell) => { const sheet = main(cell); const ok = String(mine).trim() == String(sheet ?? '').trim() || (Number(mine) === Number(sheet)); checks.push([ok ? 'ok ' : 'XX ', label, 'mine=' + mine, 'sheet(' + cell + ')=' + sheet]); };
['str','dex','con','int','wis','cha'].forEach((a,i) => { eq(a+' score', d.abilities[a].score, 'F'+(9+i)); eq(a+' mod', d.abilities[a].mod, 'G'+(9+i)); });
eq('HP', `${d.hp.current} / ${d.hp.max}`, 'S9');
eq('Fort', d.saves.fort.total, 'F17'); eq('Ref', d.saves.ref.total, 'F18'); eq('Will', d.saves.will.total, 'F19');
eq('AC', d.ac.total, 'R17'); eq('FF', d.ac.flat, 'R18'); eq('Touch', d.ac.touch, 'R19'); eq('CMD', d.cmd, 'R20');
eq('BAB', d.bab, 'AM6'); eq('Level', d.level, 'AQ6'); eq('Init', d.initiative.total, 'O38');
eq('Ranks', `${d.skillRanks.used} / ${d.skillRanks.available}`, 'AH8');
eq('BG ranks', `${d.skillRanks.bgUsed} / ${d.skillRanks.bgAvailable}`, 'AH34');
eq('Speed', d.speed.land, 'H37'); eq('Charge', d.speed.charge, 'I37'); eq('Run', d.speed.run, 'J37');
eq('Wpn1 atk', d.weapons[0].attackText, 'O26'); eq('Wpn1 dmg', d.weapons[0].damageText.replace('+ ','+ '), 'V26'); eq('Wpn2 atk', d.weapons[1].attackText, 'O27');
eq('Armor AC', d.armor.armor.ac, 'O42'); eq('ACP', d.armor.armor.acp, 'P42'); eq('MaxDex', d.armor.armor.maxDex, 'Q42'); eq('ASF', d.armor.asf, 'BO50');
for (let L = 0; L <= 4; L++) eq('Spells/day L' + L, d.spells.levels[L].perDay ?? '', 'D' + (55 + L));
eq('Class lvl', d.spells.classLevel, 'D66'); eq('CL', d.spells.cl, 'D68');
// skills: compare totals by name for rows 9-45
for (let r = 9; r <= 45; r++) {
  const nm = main('AE' + r); if (!nm || /SKILLS/.test(nm)) continue;
  const s = d.skills.find(x => x.name === nm) || d.specialty.find(x => x.name === nm);
  if (!s) { checks.push(['?? ', 'skill missing', nm]); continue; }
  eq('skill ' + nm, s.total === null ? '' : s.total, 'AJ' + r);
}
console.log(checks.map(c => c.join('  ')).join('\n'));
console.log('FAILS', checks.filter(c => c[0] !== 'ok ').length, 'of', checks.length, '| warnings:', warnings);
