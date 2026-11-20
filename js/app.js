// UI: rendering, data binding, persistence, rolling.
(function () {
  'use strict';
  const D = window.PF_DATA, M = window.PF_MODEL, E = window.PF_ENGINE, DICE = window.PF_DICE, DC = window.PF_DISCORD;

  // ---------- State & persistence ----------
  const LS = { roster: 'pfas.roster', char: id => 'pfas.char.' + id, settings: 'pfas.settings', log: 'pfas.log' };
  const App = { ch: null, d: null, tab: 'play', skillFilter: '', roster: { ids: [], current: null }, settings: {}, log: [], showAllSpellLevels: false };

  function lsGet(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  let saveTimer = null;
  function scheduleSave() {
    setSaveState('Unsaved…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }
  function saveNow() {
    if (!App.ch) return;
    const ok = lsSet(LS.char(App.ch.id), App.ch);
    if (!App.roster.ids.includes(App.ch.id)) App.roster.ids.push(App.ch.id);
    App.roster.current = App.ch.id;
    lsSet(LS.roster, App.roster);
    setSaveState(ok ? 'Saved' : 'Not saved (browser storage blocked). Export to keep your work.');
    renderRosterSelect();
  }
  function setSaveState(t) { const el = $('#save-state'); if (el) el.textContent = t; }

  function loadCharacter(id) {
    const ch = lsGet(LS.char(id), null);
    if (!ch) return false;
    App.ch = M.normalize(ch);
    App.roster.current = id;
    lsSet(LS.roster, App.roster);
    recompute();
    render();
    return true;
  }
  function adoptCharacter(ch) {
    App.ch = M.normalize(ch);
    if (!App.ch.id) App.ch.id = M.uid();
    saveNow();
    recompute();
    render();
  }

  // ---------- Helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sign = n => (n === null || n === undefined || n === '') ? '—' : ((n >= 0 ? '+' : '') + n);
  function pathGet(obj, path) { return path.split('/').reduce((o, k) => (o === null || o === undefined) ? undefined : o[k], obj); }
  function pathSet(obj, path, val) {
    const keys = path.split('/');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] === undefined || o[keys[i]] === null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = val;
  }
  const get = p => pathGet(App.ch, p);
  const dget = p => pathGet(App.d, p);

  function fmt(v, f) {
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '—';
    if (f === 'sign') return sign(v);
    if (f === 'pct') return Math.round(v * 100) + '%';
    if (f === 'ft') return v + ' ft';
    if (f === 'cs') return v ? '●' : '';
    return String(v);
  }

  // Controls
  function inp(path, o = {}) {
    const v = get(path);
    const isNum = o.type === 'num';
    const cls = (isNum ? 'n ' : '') + (o.cls || '');
    return `<input ${isNum ? 'type="number" step="any" inputmode="decimal"' : 'type="text"'} class="${cls}" data-bind="${esc(path)}" data-type="${o.type || 'text'}" value="${esc(v)}"` +
      `${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.aria ? ` aria-label="${esc(o.aria)}"` : ''}${o.title ? ` title="${esc(o.title)}"` : ''}${o.list ? ` list="${o.list}"` : ''}>`;
  }
  function area(path, o = {}) {
    return `<textarea data-bind="${esc(path)}" data-type="text" rows="${o.rows || 3}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.aria ? ` aria-label="${esc(o.aria)}"` : ''}>${esc(get(path))}</textarea>`;
  }
  function sel(path, options, o = {}) {
    const cur = get(path);
    const norm = options.map(x => typeof x === 'object' ? x : { v: x, l: x });
    let html = '', group = null;
    const known = norm.some(x => String(x.v) === String(cur));
    if (o.blank !== false) html += `<option value="">${esc(o.blank || '')}</option>`;
    if (!known && cur !== '' && cur !== undefined && cur !== null) html += `<option value="${esc(cur)}" selected>${esc(cur)} (not in list)</option>`;
    for (const x of norm) {
      if (x.g !== group) { if (group !== null) html += '</optgroup>'; if (x.g) html += `<optgroup label="${esc(x.g)}">`; group = x.g || null; }
      html += `<option value="${esc(x.v)}"${String(x.v) === String(cur) ? ' selected' : ''}>${esc(x.l)}</option>`;
    }
    if (group) html += '</optgroup>';
    return `<select${o.cls ? ` class="${o.cls}"` : ''} data-bind="${esc(path)}" data-type="${o.type || 'text'}"${o.rerender ? ' data-rerender' : ''}${o.aria ? ` aria-label="${esc(o.aria)}"` : ''}>${html}</select>`;
  }
  function chk(path, o = {}) {
    return `<input type="checkbox" data-bind="${esc(path)}" data-type="bool"${get(path) ? ' checked' : ''}${o.rerender ? ' data-rerender' : ''}${o.aria ? ` aria-label="${esc(o.aria)}"` : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>`;
  }
  function out(path, f, cls) {
    return `<span class="${cls === undefined ? 'calc' : cls}" data-out="${esc(path)}" data-fmt="${f || ''}">${esc(fmt(dget(path), f))}</span>`;
  }
  function rollBtn(label, modPath, o = {}) {
    return `<button class="roll${o.big ? ' big-roll' : ''}" data-action="roll-check" data-label="${esc(label)}" data-mod="${esc(modPath)}" title="Roll ${esc(label)} (Shift-click for a private roll)">` +
      `<span data-out="${esc(modPath)}" data-fmt="sign">${esc(fmt(dget(modPath), 'sign'))}</span></button>`;
  }
  function field(label, control, cls) { return `<label class="field${cls ? ' ' + cls : ''}">${esc(label)}${control}</label>`; }
  function card(title, body, o = {}) {
    return `<section class="card${o.cls ? ' ' + o.cls : ''}"${o.id ? ` id="${o.id}"` : ''}><header><h2>${esc(title)}</h2><span class="spacer"></span>${o.tools || ''}</header>${body}</section>`;
  }
  function removeBtn(list, i, label) { return `<button class="icon-btn" data-action="remove" data-list="${esc(list)}" data-i="${i}" aria-label="Remove ${esc(label || 'row')}" title="Remove">✕</button>`; }

  const classOptions = () => {
    const opts = (App.ch.customClasses || []).map(c => ({ v: c.name, l: c.name, g: 'From your spreadsheet' }));
    for (const c of D.classes) opts.push({ v: c.name, l: c.name, g: c.cat });
    return opts;
  };

  // ---------- Compute & output refresh ----------
  function recompute() {
    try { App.d = E.compute(App.ch); } catch (e) { console.error(e); toast('Calculation error: ' + e.message); }
  }
  function updateOutputs() {
    for (const el of $$('[data-out]')) {
      const t = fmt(dget(el.dataset.out), el.dataset.fmt);
      if (el.textContent !== t) el.textContent = t;
    }
    // HP bar
    const bar = $('#hp-bar');
    if (bar && App.d) {
      const pct = App.d.hp.max > 0 ? Math.max(0, Math.min(100, App.d.hp.current / App.d.hp.max * 100)) : 0;
      bar.firstElementChild.style.width = pct + '%';
      bar.classList.toggle('low', pct < 50);
    }
    $$('tr[data-skill-row]').forEach(tr => {
      const s = dget(tr.dataset.skillRow);
      if (!s) return;
      tr.classList.toggle('untrained', !!s.untrained);
    });
    $$('.bonus-value').forEach(el => {
      el.classList.toggle('bad', !E.isValidBonus(el.value, App.d.formulaVars));
      const out = el.parentElement && el.parentElement.querySelector('.bonus-result');
      if (out) out.textContent = bonusResult(el);
    });
    $$('[data-roll-disabled]').forEach(b => { b.disabled = dget(b.dataset.rollDisabled) === null; });
    document.title = (App.ch && App.ch.info.name ? App.ch.info.name + ' · ' : '') + 'PF Autosheet';
  }

  // ---------- Rendering ----------
  const TABS = [
    ['play', 'Play'], ['character', 'Character'], ['race', 'Race'], ['skills', 'Skills'], ['combat', 'Combat'], ['spells', 'Spells'],
    ['effects', 'Effects'], ['features', 'Features & Gear'], ['notes', 'Notes'], ['settings', 'Settings'],
  ];

  function render() {
    renderRosterSelect();
    renderTabs();
    const main = $('#main');
    if (!App.ch) { main.innerHTML = renderEmpty(); return; }
    const y = window.scrollY;
    const fn = { play: renderPlay, character: renderOverview, overview: renderOverview, race: renderRace, skills: renderSkills, combat: renderCombat, spells: renderSpells, effects: renderEffects,
      features: renderFeatures, notes: renderNotes, settings: renderSettings }[App.tab] || renderOverview;
    main.innerHTML = fn() + `<datalist id="weapon-names">${App.ch.weapons.filter(w => w.name).map(w => `<option value="${esc(w.name)}">`).join('')}</datalist>`;
    updateOutputs();
    window.scrollTo(0, y);
    renderDiscordState();
  }

  function renderTabs() {
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button role="tab" aria-selected="${App.tab === k}" data-action="tab" data-tab="${k}">${l}</button>`).join('');
    $('#tabs').classList.toggle('hidden', !App.ch);
  }
  function renderRosterSelect() {
    const selEl = $('#roster');
    if (!selEl) return;
    const items = App.roster.ids.map(id => {
      const c = id === (App.ch && App.ch.id) ? App.ch : lsGet(LS.char(id), null);
      return c ? { id, name: (c.info && c.info.name) || 'Unnamed character' } : null;
    }).filter(Boolean);
    selEl.innerHTML = items.map(x => `<option value="${esc(x.id)}"${App.ch && x.id === App.ch.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('') ||
      '<option value="">No characters</option>';
  }

  function renderEmpty() {
    return `<div class="card empty">
      <h1>Pathfinder Autosheet</h1>
      <p class="muted">A web version of the Pathfinder Autosheet v6.2.1, with dice rolls sent to Discord.</p>
      <p><button class="btn primary" data-action="new-char">New character</button>
      <button class="btn" data-action="import">Import a character</button></p>
      <div class="drop-zone" id="drop-zone" data-action="import">Drop an Autosheet <span class="kbd">.xlsx</span> or a saved <span class="kbd">.json</span> here</div>
      <p class="small muted">In Google Sheets, open your character and choose File → Download → Microsoft Excel (.xlsx).</p>
    </div>`;
  }

  // ----- Overview
  function renderOverview() {
    const d = App.d, ch = App.ch;
    const identity = card('Character', `<div class="fields">
      ${field('Name', inp('info/name'))}${field('Player', inp('info/player'))}
      ${field('Alignment', inp('info/alignment', { ph: 'e.g. CN' }))}${field('Race', inp('info/race'))}
      ${field('Deity', inp('info/deity'))}${field('Gender', inp('info/gender'))}
      ${field('Base size', sel('info/size', M.SIZES.map(s => s.name), { blank: false }))}
      ${field('Current size', out('size/name', '', 'calc'))}
      ${field('Age category', sel('info/age', M.AGE.categories, { blank: false }))}
      ${field('Age', inp('info/ageYears'))}${field('Height', inp('info/height'))}${field('Weight', inp('info/weight'))}
      ${field('XP track', sel('info/xpTrack', M.XP.tracks, { blank: false }))}
      ${field('Experience', inp('info/xp', { type: 'num', cls: 'n-wide' }))}
      ${field('XP to next level', out('xpToNext'))}
    </div>`, { cls: 'span-2' });

    const classRows = ch.classes.map((c, i) => `<tr>
        <td class="l">${sel(`classes/${i}/name`, classOptions(), { rerender: true, aria: 'Class ' + (i + 1), blank: '— none —', cls: 'class-select' })}</td>
        <td>${inp(`classes/${i}/level`, { type: 'num', aria: 'Level' })}</td>
        <td>${out(`classes/${i}/hd`)}</td><td>${out(`classes/${i}/bab`, 'sign')}</td>
        <td>${out(`classes/${i}/fort`, 'sign')}</td><td>${out(`classes/${i}/ref`, 'sign')}</td><td>${out(`classes/${i}/will`, 'sign')}</td>
        <td>${out(`classes/${i}/ranksPerLevel`)}</td>
        ${ch.info.hpFormula === 'Custom Rolled' ? `<td>${inp(`rolledHp/${i}`, { ph: '8, 5, 6…', aria: 'Rolled HP' })}</td>` : ''}
        <td>${i >= 3 ? removeBtn('classes', i, 'class') : ''}</td></tr>`).join('');
    const classes = card('Classes', `<div class="scroll-x"><table>
      <thead><tr><th class="l">Class</th><th>Level</th><th>HD</th><th>BAB</th><th>Fort</th><th>Ref</th><th>Will</th><th title="Skill ranks per level">Ranks/lvl</th>${ch.info.hpFormula === 'Custom Rolled' ? '<th>Rolled HP</th>' : ''}<th></th></tr></thead>
      <tbody>${classRows}</tbody>
      <tfoot><tr><td class="l"><strong>Total</strong></td><td>${out('level')}</td><td></td><td>${out('bab', 'sign')}</td>
        <td>${out('baseSaves/fort', 'sign')}</td><td>${out('baseSaves/ref', 'sign')}</td><td>${out('baseSaves/will', 'sign')}</td><td></td></tr></tfoot>
      </table></div>
      <div class="fields" style="margin-top:10px">
        ${field('HP formula', sel('info/hpFormula', M.HP_FORMULAS, { blank: false, rerender: true }))}
        ${field('Favored class: bonus HP', inp('fcb/hp', { type: 'num' }))}
        ${field('Favored class: bonus skill ranks', inp('fcb/skills', { type: 'num' }))}
        ${field('Favored class: other', inp('fcb/other'))}
      </div>`, { tools: `<button class="btn small" data-action="add-class">+ Class</button>`, cls: 'span-2' });

    const abilRows = M.ABILITIES.map(a => `<tr>
      <td class="l ability-name">${M.ABILITY_NAMES[a]}</td>
      <td>${out(`abilities/${a}/score`, '', 'calc big')}</td>
      <td>${out(`abilities/${a}/race`, 'sign')}</td>
      <td>${rollBtn(M.ABILITY_NAMES[a] + ' check', `abilities/${a}/mod`)}</td>
      <td>${inp(`abilities/${a}/base`, { type: 'num', aria: a + ' base' })}</td>
      <td>${inp(`abilities/${a}/enh`, { type: 'num', aria: a + ' enhancement' })}</td>
      <td>${inp(`abilities/${a}/inh`, { type: 'num', aria: a + ' inherent' })}</td>
      <td>${out(`abilities/${a}/temp`, 'sign')}</td>
      <td>${inp(`abilities/${a}/pen`, { type: 'num', aria: a + ' penalty' })}</td>
      <td>${out(`abilities/${a}/age`, 'sign')}</td></tr>`).join('');
    const abilities = card('Ability Scores', `<div class="scroll-x"><table>
      <thead><tr><th class="l">Ability</th><th>Score</th><th title="From the Race tab">Race</th><th>Mod</th><th>Base</th><th>Enhance</th><th>Inherent</th><th title="From the Effects tab">Temp</th><th>Penalty</th><th>Age</th></tr></thead>
      <tbody>${abilRows}</tbody></table></div>`);

    const hp = card('Hit Points', `
      <div class="inline"><span class="big"><span data-out="hp/current">${d.hp.current}</span> / <span data-out="hp/max">${d.hp.max}</span></span></div>
      <div class="hp-bar" id="hp-bar"><span></span></div>
      <div class="inline" style="margin-bottom:8px">
        <input type="number" id="hp-amount" class="n-wide" placeholder="amt" aria-label="Amount">
        <button class="btn small" data-action="hp" data-mode="damage">Damage</button>
        <button class="btn small" data-action="hp" data-mode="heal">Heal</button>
        <button class="btn small" data-action="hp" data-mode="nonlethal">Nonlethal</button>
        <button class="btn small" data-action="hp" data-mode="temp">Temp HP</button>
      </div>
      <div class="fields">
        ${field('Damage taken', inp('hp/damage', { type: 'num' }))}${field('Temp HP', inp('hp/temp', { type: 'num' }))}
        ${field('Nonlethal', inp('hp/nonlethal', { type: 'num' }))}
      </div>
      <div class="fields" style="margin-top:8px">${field('DR / SR', inp('hp/dr', { ph: 'DR 5/magic, SR 15' }))}${field('Resistances', inp('hp/resist', { ph: 'Fire 10, Cold 5' }))}</div>
      ${ch.settings.woundThresholds ? `<p class="small"><strong>Wound threshold:</strong> ${out('woundState', '', '')}</p>` : ''}`);

    const saveRow = (k, label) => `<tr><td class="l ability-name">${label}</td><td>${rollBtn(label + ' save', `saves/${k}/total`, { big: false })}</td>
      <td>${out(`saves/${k}/base`, 'sign')}</td><td>${out(`saves/${k}/ability`, 'sign')}</td><td>${out(`saves/${k}/resist`, 'sign')}</td>
      <td>${inp(`saves/${k}/misc`, { type: 'num', aria: label + ' misc' })}</td><td>${out(`saves/${k}/temp`, 'sign')}</td></tr>`;
    const saves = card('Saving Throws', `<table><thead><tr><th class="l">Save</th><th>Total</th><th>Base</th><th>Ability</th><th>Resist</th><th>Misc</th><th>Temp</th></tr></thead>
      <tbody>${saveRow('fort', 'Fortitude')}${saveRow('ref', 'Reflex')}${saveRow('will', 'Will')}</tbody></table>
      <div style="margin-top:8px">${field('Save notes', area('saves/notes', { rows: 2 }))}</div>`);

    const tile = (label, inner, extra) => `<div class="tile"><div class="label">${label}</div><div class="value">${inner}</div>${extra || ''}</div>`;
    const defenses = card('Defense & Initiative', `<div class="tiles">
        ${tile('Armor Class', out('ac/total', '', ''))}${tile('Touch', out('ac/touch', '', ''))}${tile('Flat-footed', out('ac/flat', '', ''))}
        ${tile('CMD', out('cmd', '', ''))}
        ${tile('Initiative', rollBtn('Initiative', 'initiative/total'))}
        ${tile('CMB', rollBtn('Combat maneuver', 'cmb'))}
      </div>
      <div class="scroll-x" style="margin-top:10px"><table>
        <thead><tr><th>Armor</th><th>Shield</th><th>Dex</th><th>Size</th><th>Natural</th><th>Deflect</th><th>Dodge</th><th>Misc</th><th>Temp</th></tr></thead>
        <tbody><tr>${['armor', 'shield', 'dex', 'size', 'natural', 'deflect', 'dodge'].map(k => `<td>${out('ac/parts/' + k, 'sign')}</td>`).join('')}
          <td>${inp('ac/misc', { type: 'num', aria: 'AC misc' })}</td><td>${out('ac/parts/temp', 'sign')}</td></tr></tbody>
      </table></div>
      <div class="fields" style="margin-top:8px">
        ${field('Initiative misc', inp('initiative/misc', { type: 'num' }))}
        ${field('Speed', out('speed/land', 'ft'))}
        ${field('AC notes', inp('ac/notes'))}
      </div>`);


    return `<div class="grid two">${identity}${classes}${abilities}${hp}${saves}${defenses}</div>`;
  }

  // Formula help: shown from the ? next to every bonus value.
  function formulaHelp() {
    const C = (App.d.formulaVars && App.d.formulaVars.C) || {};
    const mine = App.ch.classes.map((c, i) => c.name && c.level ? `<code>class${i + 1}</code> or <code>${esc(E.classSlug(c.name))}</code> = ${esc(C[E.classSlug(c.name)] || 0)} (${esc(c.name)})` : '').filter(Boolean);
    return `<span class="help-tip" tabindex="0" role="button" aria-label="Formula help">?<span class="help-pop" role="tooltip">
      <strong>Value: a number or a formula</strong><br>
      <strong>Variables</strong><br>
      <code>level</code> your total character level<br>
      <code>bab</code> base attack bonus<br>
      <code>str dex con int wis cha</code> ability modifiers<br>
      <code>ranks</code> ranks in the skill this bonus targets<br>
      <code>class1 class2 class3</code> levels in your 1st, 2nd, 3rd class<br>
      a class name, e.g. <code>rogue</code>, <code>cleric</code>, <code>monk_unchained</code>: your levels in it (spaces and brackets become _)<br>
      ${mine.length ? `<em>Yours:</em> ${mine.join('; ')}<br>` : ''}
      <strong>Functions</strong><br>
      <code>floor(x)</code> round down · <code>ceil(x)</code> round up<br>
      <code>max(a, b)</code> the larger · <code>min(a, b)</code> the smaller<br>
      <code>a >= b ? x : y</code> x if a is at least b, otherwise y<br>
      <strong>Examples</strong><br>
      Toughness: <code>max(3, level)</code><br>
      Trapfinding: <code>max(1, floor(rogue/2))</code><br>
      Skill Focus: <code>ranks >= 10 ? 6 : 3</code><br>
      +1 per 4 levels: <code>floor(level/4) + 1</code></span></span>`;
  }
  // What a bonus value works out to right now (shown as "= 3" next to formulas).
  function bonusResult(el) {
    const v = String(el.value || '').trim();
    if (!v || /^[-+]?\d+(\.\d+)?$/.test(v)) return '';
    const V = Object.assign({}, App.d.formulaVars || {});
    if (el.dataset.target === 'skill' && el.dataset.skill) {
      const key = el.dataset.skill.replace(/:$/, '').toLowerCase();
      const s = App.d.skills.concat(App.d.specialty).find(x => x.name.replace(/:$/, '').toLowerCase() === key);
      V.ranks = s ? s.ranks : 0;
    }
    const r = E.evalBonus(v, V);
    return r === null ? '' : '= ' + (r >= 0 ? '+' : '') + r;
  }

  // ----- Shared bonus editor (race, traits, feats, class features)
  function skillNameList() { return App.d.skills.map(s => s.name).concat(M.SPECIALTY_SKILLS); }
  function bonusEditor(listPath, list, o = {}) {
    const skillNames = skillNameList();
    const rows = (list || []).map((b, i) => {
      const p = `${listPath}/${i}`;
      let detail;
      if (b.target === 'skill') detail = sel(`${p}/skill`, skillNames, { blank: '— skill —', aria: 'Skill' });
      else if (b.target === 'weapon' || b.target === 'weaponDmg') detail = inp(`${p}/weapon`, { ph: 'Weapon name contains…', list: 'weapon-names', aria: 'Weapon' });
      else detail = inp(`${p}/text`, { ph: b.target === 'note' ? 'When it applies' : 'Notes (optional)', aria: 'Notes' });
      const bad = E.isValidBonus(b.value, App.d.formulaVars) ? '' : ' bad';
      return `<div class="bonus-row${o.label ? ' with-label' : ''}${b.active === false ? ' inactive' : ''}">
        <input type="checkbox" data-bind="${p}/active" data-type="bool" data-rerender aria-label="Bonus on"${b.active === false ? '' : ' checked'}>
        ${o.label ? inp(`${p}/label`, { ph: 'Name', aria: 'Bonus name' }) : ''}
        ${o.fixedType ? `<span class="sub">${esc(o.fixedType)}</span>` : sel(`${p}/type`, M.BONUS_TYPES, { blank: false, aria: 'Bonus type' })}
        ${sel(`${p}/target`, M.BONUS_TARGETS, { blank: false, rerender: true, aria: 'Applies to' })}
        ${detail}
        ${b.target === 'note' ? '<span></span>' : `<span class="val-cell">${inp(`${p}/value`, { ph: '2 or a formula', aria: 'Value', cls: 'bonus-value' + bad, title: 'A number, or a formula. Click the ? for help.' })
          .replace('<input ', `<input data-target="${esc(b.target)}" data-skill="${esc(b.skill || '')}" `)}<span class="bonus-result"></span>${formulaHelp()}</span>`}
        ${removeBtn(listPath, i, 'bonus')}</div>`;
    }).join('');
    return rows ? `<div class="bonus-list">${rows}</div>` : '';
  }
  function addBonusButtons(listPath, defType, suggestKind, i, key) {
    return `<div class="inline small bonus-tools"><button class="btn small ghost" data-action="add-bonus" data-list="${esc(listPath)}" data-type="${esc(defType)}">+ Bonus</button>` +
      (suggestKind ? `<button class="btn small ghost" data-action="suggest-bonus" data-list="${esc(key)}" data-i="${i}" data-kind="${suggestKind}" title="Fill in the usual bonuses for this ${suggestKind}">Add standard bonuses</button>` : '') + `</div>`;
  }
  function featureList(key) {
    const ch = App.ch;
    return ch[key].map((x, i) => {
      let head, desc = '', kind = null, defType = 'Untyped (stacks)';
      if (key === 'feats') {
        head = `${inp(`feats/${i}/level`, { ph: 'Lvl', aria: 'Level gained' })}${inp(`feats/${i}/name`, { ph: 'Power Attack' })}`;
        desc = area(`feats/${i}/text`, { rows: 1, ph: 'Description' }); kind = 'feat';
      } else if (key === 'slots') {
        head = `${inp(`slots/${i}/slot`, { ph: 'slot', aria: 'Slot' })}${inp(`slots/${i}/item`, { ph: 'empty', aria: 'Item' }).replace('<input ', '<input data-rerender-blur ')}`;
        kind = 'item'; defType = 'Enhancement';
      } else if (key === 'traits') {
        head = `${sel(`traits/${i}/kind`, ['Trait', 'Drawback', 'DB'], { blank: false })}${inp(`traits/${i}/text`, { ph: 'Reactionary: +2 Initiative' })}`;
        kind = 'trait'; defType = 'Trait';
      } else {
        head = `${inp(`classFeatures/${i}/name`, { ph: 'Channel Energy' })}`;
        desc = area(`classFeatures/${i}/text`, { rows: 1, ph: 'Description' });
      }
      const hasBonuses = (x.bonuses || []).length > 0;
      // An empty item slot doesn't need bonus buttons until something is in it.
      const emptySlot = key === 'slots' && !String(x.item || '').trim() && !hasBonuses;
      return `<div class="feature-item"><div class="feature-head ${key}">${head}${removeBtn(key, i)}</div>${desc}
        ${bonusEditor(`${key}/${i}/bonuses`, x.bonuses)}
        ${emptySlot ? '' : addBonusButtons(`${key}/${i}/bonuses`, defType, hasBonuses ? null : kind, i, key)}</div>`;
    }).join('') || '<p class="small muted">None yet.</p>';
  }
  function suggestBonuses(key, i, kind) {
    const item = App.ch[key][i];
    const name = key === 'traits' ? item.text : key === 'slots' ? item.item : item.name;
    const res = window.PF_FEATS.suggest(kind, name, skillNameList());
    if (!res) { toast(`No standard bonuses known for "${name || 'this ' + kind}". Use + Bonus to add your own.`); return; }
    item.bonuses = (item.bonuses || []).concat(res);
    changed(true);
    toast(`Added ${res.length} bonus${res.length === 1 ? '' : 'es'} for ${name}.`);
  }
  function situationalNotes() {
    const out = [];
    const add = (src, list) => (list || []).forEach(b => { if (b.active !== false && b.target === 'note' && (b.text || b.label)) out.push({ src, text: b.text || '' , label: b.label || '' }); });
    add(App.ch.info.race || 'Race', App.ch.race.bonuses);
    App.ch.traits.forEach(t => add(String(t.text || 'Trait').split(':')[0], t.bonuses));
    App.ch.feats.forEach(f => add(f.name || 'Feat', f.bonuses));
    App.ch.classFeatures.forEach(f => add(f.name || 'Class feature', f.bonuses));
    App.ch.slots.forEach(s => add(s.item || s.slot || 'Worn item', s.bonuses));
    return out;
  }

  // ----- Generic choice dialog
  function choiceDialog(title, intro, choices, def) {
    return new Promise(resolve => {
      const dlg = document.createElement('dialog');
      dlg.innerHTML = `<h2>${esc(title)}</h2>${intro}<form method="dialog">
        ${choices.map(c => `<label class="choice"><input type="radio" name="choice" value="${esc(c.v)}"${c.v === def ? ' checked' : ''}><span><strong>${esc(c.l)}</strong><br><span class="small muted">${esc(c.desc)}</span></span></label>`).join('')}
        <div class="actions"><button class="btn" value="cancel">Cancel</button><button class="btn primary" value="ok">Apply</button></div></form>`;
      document.body.appendChild(dlg);
      dlg.addEventListener('close', () => {
        const v = dlg.returnValue === 'ok' ? (dlg.querySelector('input[name=choice]:checked') || {}).value : null;
        dlg.remove();
        resolve(v || null);
      });
      dlg.showModal();
    });
  }

  // ----- Play tab: everything needed at the table on one page
  function renderPlay() {
    const ch = App.ch, d = App.d;
    const classLine = d.classes.filter(c => c.data && c.level).map(c => `${c.name} ${c.level}`).join(' / ') || 'No class yet';
    const sub = [ch.info.race, classLine, ch.info.alignment, d.size.name !== 'Medium' ? d.size.name : ''].filter(Boolean).join(' · ');
    const tile = (label, inner) => `<div class="tile"><div class="label">${label}</div><div class="value">${inner}</div></div>`;
    const header = `<section class="card play-header span-all">
      <div class="play-id"><h1>${esc(ch.info.name || 'Unnamed')}</h1><div class="muted">${esc(sub)}</div>
        <div class="play-hp">
          <span class="big"><span data-out="hp/current">${d.hp.current}</span> / <span data-out="hp/max">${d.hp.max}</span> HP</span>
          ${ch.hp.temp ? `<span class="sub">incl. ${esc(ch.hp.temp)} temp</span>` : ''}${ch.hp.nonlethal ? `<span class="sub">${esc(ch.hp.nonlethal)} nonlethal</span>` : ''}
          <div class="hp-bar" id="hp-bar"><span></span></div>
          <div class="inline"><input type="number" id="hp-amount" class="n-wide" placeholder="amt" aria-label="Amount">
            <button class="btn small" data-action="hp" data-mode="damage">Damage</button><button class="btn small" data-action="hp" data-mode="heal">Heal</button>
            <button class="btn small" data-action="hp" data-mode="temp">Temp</button><button class="btn small" data-action="hp" data-mode="nonlethal">Nonlethal</button></div>
          ${ch.settings.woundThresholds ? `<div class="small">${out('woundState', '', '')}</div>` : ''}
          ${ch.hp.dr || ch.hp.resist ? `<div class="small muted">${esc([ch.hp.dr, ch.hp.resist].filter(Boolean).join(' · '))}</div>` : ''}
        </div></div>
      <div class="tiles play-tiles">
        ${tile('AC', out('ac/total', '', ''))}${tile('Touch', out('ac/touch', '', ''))}${tile('Flat-footed', out('ac/flat', '', ''))}${tile('CMD', out('cmd', '', ''))}
        ${tile('Initiative', rollBtn('Initiative', 'initiative/total'))}${tile('CMB', rollBtn('Combat maneuver', 'cmb'))}
        ${tile('Speed', out('speed/land', 'ft', ''))}${tile('BAB', out('bab', 'sign', ''))}
      </div></section>`;

    const saveBtn = (k, label) => `<div class="save-btn"><span class="label">${label}</span>${rollBtn(label + ' save', `saves/${k}/total`, { big: true })}</div>`;
    const checks = card('Saves & Checks', `<div class="save-row">${saveBtn('fort', 'Fort')}${saveBtn('ref', 'Reflex')}${saveBtn('will', 'Will')}</div>
      ${ch.saves.notes ? `<p class="small muted">${esc(ch.saves.notes)}</p>` : ''}
      <div class="ability-row">${M.ABILITIES.map(a => `<div class="ab-cell"><span class="label">${a.toUpperCase()} <span class="muted">${out(`abilities/${a}/score`, '', '')}</span></span>${rollBtn(M.ABILITY_NAMES[a] + ' check', `abilities/${a}/mod`)}</div>`).join('')}</div>
      ${d.spells.data ? `<div class="inline" style="margin-top:8px"><span class="small">Caster level</span>${rollBtn('Caster level check', 'spells/cl')}<span class="small">Concentration</span>${rollBtn('Concentration', 'spells/concentration')}</div>` : ''}`);

    const atkRows = ch.weapons.map((w, i) => `<tr>
        <td class="l"><strong>${esc(w.name || 'Unnamed weapon')}</strong><div class="sub">${esc(w.crit || '20')}/${esc(w.mult || 'x2')}${w.range ? ' · ' + esc(w.range) + ' ft' : ''}${w.type ? ' · ' + esc(w.type) : ''}</div></td>
        <td><span class="atk-text" data-out="weapons/${i}/attackText" data-fmt="">${esc(fmt(d.weapons[i] && d.weapons[i].attackText))}</span><div class="sub" data-out="weapons/${i}/damageText" data-fmt="">${esc(fmt(d.weapons[i] && d.weapons[i].damageText))}</div></td>
        <td><span class="inline" style="flex-wrap:nowrap;justify-content:flex-end">
          <button class="btn small primary" data-action="attack" data-i="${i}" data-mode="full" title="Shift-click for a private roll">Full</button>
          <button class="btn small" data-action="attack" data-i="${i}" data-mode="single">Single</button>
          <button class="btn small" data-action="attack" data-i="${i}" data-mode="damage">Dmg</button></span></td></tr>`).join('');
    const attacks = card('Attacks', atkRows ? `<div class="scroll-x"><table><tbody>${atkRows}</tbody></table></div>`
      : `<p class="muted">No attacks yet. <button class="btn small" data-action="add-weapon">+ Add a weapon</button></p>`,
      { cls: 'span-2', tools: `<button class="btn small ghost" data-action="tab" data-tab="combat">Edit</button>` });

    const shown = ch.toggles.map((t, i) => [t, i]).filter(([t]) => t.active || !/^\(Custom Effect/.test(t.name));
    const others = D.conditions.filter(c => !ch.conditions.includes(c.name));
    const buffs = card('Buffs & Conditions', `<div class="chips">${shown.map(([t, i]) =>
      `<label class="chip${t.active ? ' on' : ''}">${chk(`toggles/${i}/active`, { rerender: true })}${esc(t.name)}</label>`).join('')}
      ${ch.effects.map((e, i) => `<label class="chip${e.active ? ' on' : ''}" title="Effect (Effects tab). Click to switch ${e.active ? 'off' : 'on'}."><input type="checkbox" data-bind="effects/${i}/active" data-type="bool" data-rerender${e.active ? ' checked' : ''}>${esc(e.name || 'Effect')}</label>`).join('')}</div>
      <h3 style="margin:10px 0 6px">Conditions</h3>
      <div class="chips">${ch.conditions.map(n => `<button class="chip cond on" data-action="toggle-condition" data-name="${esc(n)}" title="Click to remove">${esc(n)} ✕</button>`).join('')}
        <select id="add-condition" aria-label="Add a condition" style="width:auto"><option value="">+ Add condition…</option>${others.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="inline" style="margin-top:8px"><span class="small">Negative levels</span>${inp('negativeLevels', { type: 'num' })}</div>
      <p class="small muted" style="margin-bottom:0">Lit = on. These are the same switches as on the Effects and Combat tabs, so changing one changes both. Create new effects on the Effects tab.</p>`);

    const filter = App.skillFilter || '';
    const all = d.skills.map((s, i) => ({ s, path: `skills/${i}` })).concat(d.specialty.map((s, i) => ({ s, path: `specialty/${i}` })));
    const skills = card('Skills', `<input type="text" id="play-skill-filter" placeholder="Filter skills…" value="${esc(filter)}" aria-label="Filter skills" style="margin-bottom:8px">
      <div class="skill-grid">${all.map(({ s, path }) => `<div class="skill-cell${s.untrained ? ' untrained' : ''}" data-skill-name="${esc(s.label.toLowerCase())}"${filter && !s.label.toLowerCase().includes(filter.toLowerCase()) ? ' hidden' : ''}>
          <span>${s.isClass ? '<span class="cs-dot" title="Class skill">●</span> ' : ''}${esc(s.label)}${s.ranks ? ` <span class="sub">${s.ranks}r</span>` : ''}</span>
          <button class="roll" data-action="roll-check" data-label="${esc(s.label)}" data-mod="${path}/total" data-roll-disabled="${path}/total"><span data-out="${path}/total" data-fmt="sign">${esc(fmt(s.total, 'sign'))}</span></button></div>`).join('')}</div>`,
      { tools: `<span class="small muted">● class skill</span>` });

    let spells = '';
    if (d.spells.data || ch.spellcasting.levels.some(l => l.spells.length)) {
      const blocks = ch.spellcasting.levels.map((lv, L) => {
        const info = d.spells.levels[L];
        if (info.perDay === null && !lv.spells.length) return '';
        const n = L > 0 && typeof info.perDay === 'number' ? info.perDay : 0;
        const pips = n ? `<span class="slot-pips">${Array.from({ length: Math.min(n, 20) }, (_, k) => `<button class="pip${k < (lv.used || 0) ? ' used' : ''}" data-action="pip" data-l="${L}" data-k="${k}" aria-label="Slot ${k + 1}"></button>`).join('')}</span>` : '';
        const names = lv.spells.filter(s => s.name).map((s, i) => `<button class="btn small spell-btn" data-action="cast" data-l="${L}" data-i="${lv.spells.indexOf(s)}" title="Cast (Shift-click: private)">${esc(s.name)}${s.prepared ? ` <span class="sub">${esc(s.prepared)}</span>` : ''}</button>`).join('');
        return `<div class="play-spell-level"><div class="inline"><strong>${L === 0 ? 'Cantrips' : 'Level ' + L}</strong><span class="sub">DC ${info.dc}${info.perDay !== null ? ' · ' + esc(String(info.perDay)) + '/day' : ''}</span>${pips}</div><div class="spell-names">${names || '<span class="sub">none listed</span>'}</div></div>`;
      }).join('');
      const slas = ch.spellcasting.sla.map((g, gi) => g.items.filter(x => x.name).map(x => `<button class="btn small spell-btn" data-action="cast-sla" data-g="${gi}" data-i="${g.items.indexOf(x)}">${esc(x.name)} <span class="sub">${esc(g.label)}${x.uses !== '' && x.uses !== undefined ? ' · ' + esc(x.uses) + ' left' : ''}</span></button>`).join('')).join('');
      spells = card(`Spells${d.spells.className ? ' · ' + d.spells.className : ''}`, blocks + (slas ? `<h3 style="margin:8px 0 4px">Spell-like abilities</h3><div class="spell-names">${slas}</div>` : ''),
        { tools: `<button class="btn small ghost" data-action="rest">Rest</button><button class="btn small ghost" data-action="tab" data-tab="spells">Edit</button>` });
    }

    const res = card('Resources', `${ch.resources.map((r, i) => `<div class="play-res"><span>${esc(r.name || 'Resource')}</span>
        <span class="counter"><button class="btn small" data-action="bump" data-path="resources/${i}/uses" data-d="-1" aria-label="Use one">−</button><strong>${esc(r.uses === '' || r.uses === undefined ? 0 : r.uses)}</strong>${r.max !== '' && r.max !== undefined ? `<span class="muted">/ ${esc(r.max)}</span>` : ''}<button class="btn small" data-action="bump" data-path="resources/${i}/uses" data-d="1" aria-label="Add one">+</button></span></div>`).join('') || '<p class="small muted">No resources. Add them on Features &amp; Gear.</p>'}
      <div class="play-res"><span><strong>Hero points</strong></span><span class="counter"><button class="btn small" data-action="bump" data-path="heroPoints/current" data-d="-1">−</button><strong>${esc(ch.heroPoints.current)}</strong><span class="muted">/ ${esc(ch.heroPoints.max)}</span><button class="btn small" data-action="bump" data-path="heroPoints/current" data-d="1">+</button></span></div>`);

    const groups = {};
    const label = { race: 'Race', trait: 'Traits', feat: 'Feats', feature: 'Class features', worn: 'Worn items', effect: 'Effects', toggle: 'Toggles', item: 'Magic items', condition: 'Conditions' };
    for (const r of d.rows) (groups[r.src] = groups[r.src] || new Set()).add(r.name);
    const notes = situationalNotes();
    const active = card('Active Bonuses', `${Object.keys(label).filter(k => groups[k]).map(k => `<p class="small"><strong>${label[k]}:</strong> ${[...groups[k]].map(esc).join(', ')}</p>`).join('') || '<p class="small muted">Nothing active.</p>'}
      ${d.overlaps.length ? `<h3 style="margin:8px 0 4px">Not stacking</h3><ul class="small notes-list">${d.overlaps.map(o => `<li>${o.names.map(n => `<strong>${esc(n)}</strong>`).join(' and ')} both give a ${esc(o.type)} bonus to ${esc(o.keys.join(', '))}. Only the highest (+${o.best}) counts.</li>`).join('')}</ul>` : ''}
      ${notes.length ? `<h3 style="margin:8px 0 4px">Situational</h3><ul class="small notes-list">${notes.map(x => `<li><strong>${esc(x.label || x.src)}</strong>${x.label && x.label !== x.src ? ` <span class="muted">(${esc(x.src)})</span>` : ''}: ${esc(x.text)}</li>`).join('')}</ul>` : ''}
      ${ch.race.senses ? `<p class="small"><strong>Senses:</strong> ${esc(ch.race.senses)}</p>` : ''}${ch.languages ? `<p class="small"><strong>Languages:</strong> ${esc(ch.languages)}</p>` : ''}`);

    // Buffs and Skills share one column so Skills always sits directly under Buffs.
    // Spells, Resources and Active Bonuses stack in the column beside them.
    const stack = `<div class="play-stack span-2">${buffs}${skills}</div>`;
    const side = `<div class="play-stack">${spells}${res}${active}</div>`;
    return `<div class="grid play-grid">${header}${checks}${attacks}${stack}${side}</div>`;
  }

  // ----- Race
  function renderRace() {
    const ch = App.ch, r = ch.race, R = window.PF_RACES;
    const presetOpts = Object.keys(R.RACES).map(n => `<option value="${esc(n)}"${r.preset === n ? ' selected' : ''}>${esc(n)}</option>`).join('');
    const main = card('Race', `<div class="fields">
        ${field('Race', inp('info/race', { ph: 'e.g. Tiefling' }))}
        <label class="field">Start from a core race<span class="inline" style="flex-wrap:nowrap"><select id="race-preset" aria-label="Core race preset"><option value="">— choose —</option>${presetOpts}</select><button class="btn small" data-action="apply-race">Apply</button></span></label>
        ${field('Size', sel('info/size', M.SIZES.map(s => s.name), { blank: false }))}
        ${field('Base speed (ft)', inp('info/speeds/base', { type: 'num' }))}
        ${field('Senses', inp('race/senses', { ph: 'e.g. darkvision 60 ft.' }))}
        ${field('Bonus skill ranks per level', inp('race/skillRanksPerLevel', { type: 'num', title: 'Human "Skilled" = 1' }))}
        ${field('Languages', inp('languages', { ph: 'Common…' }))}
      </div>
      <h3 style="margin:14px 0 6px">Racial ability modifiers</h3>
      <div class="scroll-x"><table><thead><tr>${M.ABILITIES.map(a => `<th>${esc(M.ABILITY_NAMES[a])}</th>`).join('')}</tr></thead>
        <tbody><tr>${M.ABILITIES.map(a => `<td>${inp(`race/abilityMods/${a}`, { type: 'num', aria: M.ABILITY_NAMES[a] + ' racial modifier' })}</td>`).join('')}</tr></tbody></table></div>
      <p class="inline" style="margin-top:8px"><label class="inline">${chk('race/flex', { rerender: true })} +2 to one ability score of your choice</label>
        ${r.flex ? sel('race/flexAbility', M.ABILITIES.map(a => ({ v: a, l: M.ABILITY_NAMES[a] })), { blank: '— pick one —', aria: 'Ability for the +2' }) : ''}</p>
      <p class="small muted">Racial modifiers add to your scores automatically, so enter your <em>base</em> (rolled or point-buy) scores on the Character tab. Characters imported from the spreadsheet already have racial modifiers inside their base scores, so leave these at 0 for them.</p>`,
      { cls: 'span-2' });

    const bonusHtml = bonusEditor('race/bonuses', r.bonuses, { fixedType: 'Racial', label: true });
    const bonuses = card('Racial Bonuses', (bonusHtml || '<p class="small muted">No racial bonuses yet. Apply a core race above, or add your own.</p>') +
      `<p class="small muted">These count as racial bonuses: two racial bonuses to the same thing don't stack, but they stack with every other type. "Situational" entries are reminders shown on the Play tab and don't change any numbers.</p>`,
      { tools: `<button class="btn small" data-action="add-bonus" data-list="race/bonuses" data-type="Racial">+ Bonus</button>`, cls: 'span-2' });

    const list = ch.racialFeatures.map((x, i) => `<div class="list-row feature-row">${inp(`racialFeatures/${i}/name`, { ph: 'Feature' })}${area(`racialFeatures/${i}/text`, { rows: 1, ph: 'Description' })}${removeBtn('racialFeatures', i)}</div>`).join('') || '<p class="small muted">None yet.</p>';
    const feats = card('Racial Features', list, { tools: `<button class="btn small" data-action="add" data-list="racialFeatures">+ Feature</button>`, cls: 'span-2' });
    return `<div class="grid two">${main}${bonuses}${feats}</div>`;
  }
  async function applyRacePreset(name) {
    const p = window.PF_RACES.RACES[name];
    if (!p) { toast('Choose a race first.'); return; }
    const ch = App.ch, r = ch.race;
    const imported = ch.source === 'autosheet-xlsx';
    const choice = await choiceDialog(`Apply ${name}`,
      `<p class="small">${imported ? 'This character was imported from the spreadsheet, where racial ability modifiers and bonus skill ranks are already part of the base scores. ' : ''}Anything already on the Race tab is replaced.</p>`,
      [
        { v: 'all', l: 'Everything', desc: 'Ability modifiers, bonus skill ranks, racial bonuses, size, speed, senses and features. Best for a new character.' },
        { v: 'nomods', l: 'Everything except ability modifiers and skill ranks', desc: 'For characters whose base scores already include their race (imported from the spreadsheet).' },
        { v: 'features', l: 'Features and senses only', desc: 'Adds the racial features text. No numbers change.' },
      ], imported ? 'nomods' : 'all');
    if (!choice) return;
    r.preset = name;
    ch.info.race = name;
    r.senses = p.senses || '';
    ch.racialFeatures = p.features.map(([n, t]) => ({ name: n, text: t }));
    if (!ch.languages) ch.languages = p.languages;
    if (choice !== 'features') {
      r.bonuses = p.bonuses.map(b => Object.assign({ label: '', active: true, skill: '', weapon: '', text: '' }, b));
      ch.info.size = p.size; ch.info.speeds.base = p.speed;
      if (p.slowAndSteady) ch.movement.ignoreArmor = 'Slow and Steady (ignore Encumbrance/Heavy/Medium)';
      else if (String(ch.movement.ignoreArmor || '').startsWith('Slow and Steady')) ch.movement.ignoreArmor = '';
    }
    if (choice === 'all') {
      r.abilityMods = Object.assign({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, p.abilityMods);
      r.flex = !!p.flex; r.flexAbility = '';
      r.skillRanksPerLevel = p.skillRanksPerLevel || 0;
    } else {
      r.abilityMods = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
      r.flex = false; r.flexAbility = ''; r.skillRanksPerLevel = 0;
    }
    changed(true);
    toast(choice === 'all' && p.flex ? `${name} applied. Pick which ability gets the +2.` : `${name} applied.`);
  }


  // ----- Skills
  function renderSkills() {
    const d = App.d, ch = App.ch;
    const bg = d.skillRanks.background;
    const row = (s, i, spec) => {
      const base = spec ? `specialty/${i}` : `skills/${s.name}`;
      const dpath = spec ? `specialty/${i}` : `skills/${i}`;
      const nameCell = spec
        ? `<div class="inline" style="flex-wrap:nowrap">${sel(`specialty/${i}/base`, M.SPECIALTY_SKILLS, { blank: false, rerender: true, aria: 'Skill type' })}${inp(`specialty/${i}/detail`, { ph: 'specialty', aria: 'Specialty' })}</div>`
        : `${esc(s.name)}${s.trained ? ' <span class="sub" title="Trained only">*</span>' : ''}${s.acp ? ' <span class="sub" title="Armor check penalty applies">†</span>' : ''}`;
      return `<tr data-skill-row="${dpath}">
        <td title="${s.fromClass ? 'Class skill' : 'Mark as class skill'}">${s.fromClass ? '<span class="cs-dot">●</span>' : chk(`${base}/classSkill`, { aria: 'Class skill' })}</td>
        <td class="l">${nameCell}</td>
        <td><button class="roll" data-action="roll-check" data-label="${esc(spec ? (s.label) : s.name)}" data-mod="${dpath}/total" data-roll-disabled="${dpath}/total"><span data-out="${dpath}/total" data-fmt="sign">${esc(fmt(s.total, 'sign'))}</span></button></td>
        <td>${inp(`${base}/ranks`, { type: 'num', aria: 'Ranks' })}</td>
        <td><span class="sub">${esc(s.ability)}</span> ${out(`${dpath}/abilityMod`, 'sign')}</td>
        <td>${out(`${dpath}/cls`, 'sign')}</td>
        <td>${inp(`${base}/misc`, { type: 'num', aria: 'Misc' })}</td>
        <td>${out(`${dpath}/temp`, 'sign')}</td>
        <td>${out(`${dpath}/sizeArmor`, 'sign')}</td>
        <td>${spec ? removeBtn('specialty', i, 'skill') : ''}</td></tr>`;
    };
    const head = `<thead><tr><th title="Class skill">CS</th><th class="l">Skill</th><th>Total</th><th>Ranks</th><th>Ability</th><th>Class</th><th>Misc</th><th title="From effects">Temp</th><th title="Size and armor check penalty">Size/Armor</th><th></th></tr></thead>`;
    const advRows = d.skills.map((s, i) => (!bg || !s.background) ? row(s, i, false) : '').join('');
    const bgRows = d.skills.map((s, i) => (bg && s.background) ? row(s, i, false) : '').join('');
    const specRows = d.specialty.map((s, i) => row(s, i, true)).join('');
    const summary = `<div class="inline"><span>Ranks used: <strong><span data-out="skillRanks/used">${d.skillRanks.used}</span> / <span data-out="skillRanks/available">${d.skillRanks.available}</span></strong></span>
      ${bg ? `<span>Background ranks: <strong><span data-out="skillRanks/bgUsed">${d.skillRanks.bgUsed}</span> / <span data-out="skillRanks/bgAvailable">${d.skillRanks.bgAvailable}</span></strong></span>` : ''}
      <span class="muted small">Skill system: ${esc(ch.settings.skillSystem)} (change on the Settings tab)</span></div>`;
    const main = card(bg ? 'Adventure Skills' : 'Skills', `${summary}<div class="scroll-x" style="margin-top:8px"><table>${head}<tbody>${advRows}${bg ? '' : specRows}</tbody></table></div>
      <p class="small muted">* trained only &nbsp; † armor check penalty applies &nbsp; ● class skill from your classes. Tick the box to add a class skill from a domain, trait or archetype.</p>`,
      { tools: bg ? '' : `<button class="btn small" data-action="add-specialty">+ Craft / Lore / Perform / Prof</button>` });
    const bgCard = bg ? card('Background Skills', `<div class="scroll-x"><table>${head}<tbody>${bgRows}${specRows}</tbody></table></div>`,
      { tools: `<button class="btn small" data-action="add-specialty">+ Craft / Lore / Perform / Prof</button>` }) : '';
    const langs = card('Languages', inp('languages', { ph: 'Common, Elven…' }));
    return `<div class="grid">${main}${bgCard}${langs}</div>`;
  }

  // ----- Combat
  function enhOptions() { return [{ v: '0', l: '+0' }, { v: 'Masterwork', l: 'Masterwork' }].concat([1, 2, 3, 4, 5].map(x => ({ v: String(x), l: '+' + x }))); }
  function renderCombat() {
    const ch = App.ch, d = App.d;
    const cats = D.attackCategories.map(c => ({ v: c.name, l: c.name.replace(/\s*\(.*\)$/, '') }));
    const weapons = ch.weapons.map((w, i) => {
      // Group formulas by the ability used to hit (STR, DEX, INT…) so long lists stay readable.
      const order = ['STR to hit', 'DEX to hit', 'CON to hit', 'INT to hit', 'WIS to hit', 'CHA to hit', 'Spellcasting', 'Other'];
      const opts = E.attackOptions(ch, w.category).map((o, k) => ({ v: o.label, l: o.label, g: window.PF_ATTACK_GROUP(o.label), k }))
        .sort((a, b) => (order.indexOf(a.g) - order.indexOf(b.g)) || (a.k - b.k));
      return `<div class="weapon">
        <div class="weapon-grid">
          ${field('Weapon', inp(`weapons/${i}/name`, { ph: 'Longsword +1' }))}
          ${field('Enh.', sel(`weapons/${i}/enh`, enhOptions(), { blank: false }))}
          ${field('Misc atk', inp(`weapons/${i}/mAtk`, { type: 'num' }))}
          ${field('Misc dmg', inp(`weapons/${i}/mDmg`, { type: 'num' }))}
          ${field('Attack type', sel(`weapons/${i}/category`, cats, { rerender: true, blank: '— choose —' }))}
          ${field('Formula', sel(`weapons/${i}/formula`, opts, { blank: w.category ? '— choose —' : 'pick an attack type first' }))}
        </div>
        <div class="weapon-grid2">
          ${field('Damage dice', inp(`weapons/${i}/dice`, { ph: '1d8' }))}${field('Crit range', inp(`weapons/${i}/crit`, { ph: '19-20' }))}
          ${field('Multiplier', inp(`weapons/${i}/mult`, { ph: 'x2' }))}${field('Range', inp(`weapons/${i}/range`))}${field('Type', inp(`weapons/${i}/type`, { ph: 'S, P, B' }))}
          ${field('Damage override', inp(`weapons/${i}/dmgOverride`, { ph: 'e.g. 2d6+5', title: 'Replaces the calculated damage' }))}
        </div>
        <div class="result">
          <span class="atk" data-out="weapons/${i}/attackText" data-fmt="">${esc(fmt(d.weapons[i] && d.weapons[i].attackText))}</span>
          <span class="muted">dmg</span> <span data-out="weapons/${i}/damageText" data-fmt="">${esc(fmt(d.weapons[i] && d.weapons[i].damageText))}</span>
          <span class="spacer" style="flex:1"></span>
          <button class="btn small primary" data-action="attack" data-i="${i}" data-mode="full" title="Shift-click for a private roll">Full attack</button>
          <button class="btn small" data-action="attack" data-i="${i}" data-mode="single">Single attack</button>
          <button class="btn small" data-action="attack" data-i="${i}" data-mode="damage">Damage</button>
          ${removeBtn('weapons', i, 'weapon')}
        </div></div>`;
    }).join('');
    const weaponsCard = card('Attacks', (weapons || '<p class="muted">No weapons yet. Click <strong>+ Weapon</strong> to add one.</p>') + `<div style="margin-top:10px">${field('Attack notes', area('attackNotes', { rows: 2 }))}</div>`,
      { tools: `<span class="small muted">BAB ${sign(d.bab)} · CMB ${sign(d.cmb)}</span><button class="btn small" data-action="add-weapon">+ Weapon</button>`, cls: 'span-2' });

    const toggles = card('Combat Toggles', `<div class="chips">${ch.toggles.map((t, i) =>
      `<label class="chip${t.active ? ' on' : ''}">${chk(`toggles/${i}/active`, { rerender: true })}${esc(t.name)}</label>`).join('')}</div>
      <p class="small muted">Power Attack, Combat Expertise and Deadly Aim scale with your BAB. Edit toggle values on the Effects tab.</p>`);
    const conds = card('Conditions', `<div class="chips">${D.conditions.map(c =>
      `<button class="chip cond${ch.conditions.includes(c.name) ? ' on' : ''}" data-action="toggle-condition" data-name="${esc(c.name)}">${esc(c.name)}</button>`).join('')}</div>
      <div class="fields" style="margin-top:10px">${field('Negative levels', inp('negativeLevels', { type: 'num' }))}</div>`);

    const armorRow = (k, table, label) => {
      const items = table === 'armor'
        ? D.armor.map(a => ({ v: a.name, l: `${a.name} (+${a.ac})`, g: a.type }))
        : D.shields.filter(s => s.name !== '(no shield)').map(s => ({ v: s.name, l: `${s.name} (+${s.ac})` }));
      const mats = D.materials.filter(m => table === 'armor' ? !m.shield || m.type !== '-' : m.shield).map(m => ({ v: m.name, l: m.name + (m.type && m.type !== '-' ? ` (${m.type})` : '') }));
      const p = `armor/${k}`;
      return `<tr><td class="l">${inp(`${k}/name`, { ph: label })}</td>
        <td>${sel(`${k}/item`, items, { rerender: false, blank: '— none —' })}</td>
        <td>${sel(`${k}/material`, mats, { blank: '—' })}</td>
        <td>${sel(`${k}/enh`, [{ v: 0, l: '+0' }, { v: 'Mwk', l: 'Mwk' }, 1, 2, 3, 4, 5].map(x => typeof x === 'object' ? x : { v: x, l: '+' + x }), { blank: false, type: 'numOrText' })}</td>
        <td>${inp(`${k}/mSkill`, { type: 'num', aria: 'Misc skill' })}</td><td>${inp(`${k}/mDex`, { type: 'num', aria: 'Misc max dex' })}</td>
        <td>${out(p + '/ac', 'sign')}</td><td>${out(p + '/acp')}</td><td>${out(p + '/maxDex')}</td><td>${out(p + '/asf', 'pct')}</td></tr>`;
    };
    const armor = card('Armor & Shield', `<div class="scroll-x"><table>
      <thead><tr><th class="l">Name</th><th>Item</th><th>Material</th><th>Enh.</th><th title="Misc skill penalty adjustment">mSkill</th><th title="Misc max Dex adjustment">mDex</th><th>AC</th><th>ACP</th><th>Max Dex</th><th>ASF</th></tr></thead>
      <tbody>${armorRow('armor', 'armor', 'Armor')}${armorRow('shield', 'shields', 'Shield')}</tbody></table></div>
      <div class="fields" style="margin-top:8px">
        ${field('Encumbrance', sel('movement/encumbrance', ['Light', 'Medium', 'Heavy', 'Overloaded'], { blank: false }))}
        ${field('Ignore armor for speed', sel('movement/ignoreArmor', ['Slow and Steady (ignore Encumbrance/Heavy/Medium)', 'Armor Training II (ignore Heavy/Medium)', 'Armor Training I (ignore Medium)'], { blank: 'No' }))}
        ${field('Armor category', out('armor/armorCat'))}${field('Total ACP', out('armor/acp'))}${field('Spell failure', out('armor/asf', 'pct'))}
      </div>
      <div style="margin-top:8px">${field('Armor notes', area('armorNotes', { rows: 2 }))}</div>`, { cls: 'span-2' });

    const modes = ['fly', 'swim', 'burrow', 'climb'];
    const speedRows = `<tr><td class="l">Land</td><td>${inp('info/speeds/base', { type: 'num' })}</td><td>${out('speed/land', 'ft')}</td><td>${out('speed/charge', 'ft')}</td><td>${out('speed/run', 'ft')}</td></tr>` +
      modes.map(k => `<tr><td class="l">${k[0].toUpperCase() + k.slice(1)}</td><td>${inp('info/speeds/' + k, { type: 'num' })}</td>
        <td>${out(`speed/modes/${k}/move`, 'ft')}</td><td>${out(`speed/modes/${k}/charge`, 'ft')}</td><td>${out(`speed/modes/${k}/run`, 'ft')}</td></tr>`).join('');
    const move = card('Movement', `<table><thead><tr><th class="l">Mode</th><th>Base</th><th>Move</th><th>Charge</th><th>Run</th></tr></thead><tbody>${speedRows}</tbody></table>
      <div class="fields" style="margin-top:8px">
        ${field('Flight maneuverability', sel('movement/flight', ['Clumsy', 'Poor', 'Average', 'Good', 'Perfect'], { blank: false }))}
        ${field('Run multiplier', inp('movement/runMult', { type: 'num', ph: 'auto' }))}
        ${field('Charge bonus distance', inp('movement/chargeBonus', { type: 'num' }))}
      </div>`);

    return `<div class="grid two">${weaponsCard}${toggles}${conds}${armor}${move}</div>`;
  }

  // ----- Spells
  function renderSpells() {
    const ch = App.ch, d = App.d, sc = ch.spellcasting, sp = d.spells;
    const clsNames = ch.classes.map(c => c.name).filter(Boolean);
    const header = card('Spellcasting', `<div class="fields">
        ${field('Casting class', sel('spellcasting/className', clsNames, { rerender: true, blank: '— none —' }))}
        ${field('Casting ability', sel('spellcasting/ability', M.ABILITIES.map(a => ({ v: a, l: M.ABILITY_NAMES[a] })), { blank: false }))}
        ${field('Class level misc', inp('spellcasting/classLevelMisc', { type: 'num' }))}
        ${field('Caster level misc', inp('spellcasting/clMisc', { type: 'num' }))}
      </div>
      <div class="tiles" style="margin-top:10px">
        <div class="tile"><div class="label">Class level</div><div class="value">${out('spells/classLevel', '', '')}</div></div>
        <div class="tile"><div class="label">Caster level</div><div class="value">${rollBtn('Caster level check', 'spells/cl')}</div></div>
        <div class="tile"><div class="label">Concentration</div><div class="value">${rollBtn('Concentration', 'spells/concentration')}</div></div>
        <div class="tile"><div class="label">Ability mod</div><div class="value">${out('spells/castMod', 'sign', '')}</div></div>
        <div class="tile"><div class="label">Spell failure</div><div class="value">${out('spells/asf', 'pct', '')}</div></div>
      </div>
      ${sp.data && sp.data.stat && sp.data.stat.toLowerCase() !== sc.ability ? `<p class="small muted">${esc(sp.className)} usually casts with ${esc(sp.data.stat)}.</p>` : ''}`,
      { cls: 'span-2', tools: `<button class="btn small" data-action="rest">Rest (reset slots &amp; resources)</button>
        <label class="inline small"><input type="checkbox" data-action="toggle-all-levels"${App.showAllSpellLevels ? ' checked' : ''}> Show all levels</label>` });

    const blocks = sc.levels.map((lv, L) => {
      const info = sp.levels[L];
      const show = App.showAllSpellLevels || info.perDay !== null || lv.spells.length || (L === 0 && sp.data);
      if (!show) return '';
      const perDayNum = L > 0 && typeof info.perDay === 'number' ? info.perDay : 0;
      const pips = perDayNum > 0 ? `<span class="slot-pips" title="Slots used today">${Array.from({ length: Math.min(perDayNum, 20) }, (_, k) =>
        `<button class="pip${k < (lv.used || 0) ? ' used' : ''}" data-action="pip" data-l="${L}" data-k="${k}" aria-label="Slot ${k + 1}"></button>`).join('')}</span>` : '';
      const rows = lv.spells.map((s, i) => `<div class="spell-row">
          ${inp(`spellcasting/levels/${L}/spells/${i}/prepared`, { ph: 'x', aria: 'Prepared marks', title: 'Prepared count, e.g. x or xx' })}
          ${inp(`spellcasting/levels/${L}/spells/${i}/name`, { ph: 'Spell name', aria: 'Spell' })}
          <button class="btn small" data-action="cast" data-l="${L}" data-i="${i}" title="Post to the roll log (Shift-click: private)">Cast</button>
          ${removeBtn(`spellcasting/levels/${L}/spells`, i, 'spell')}</div>`).join('');
      return `<div class="spell-level">
        <header><h3>${L === 0 ? 'Cantrips / Orisons' : 'Level ' + L}</h3>
          <span class="small">DC <strong>${out(`spells/levels/${L}/dc`, '', '')}</strong></span>
          <span class="small">Per day <strong>${out(`spells/levels/${L}/perDay`, '', '')}</strong></span>
          <span class="small">${info.known !== null ? 'Known <strong>' + esc(fmt(info.known)) + '</strong>' : ''}</span>
          <label class="small inline" title="Type a number to override the per-day count">override ${inp(`spellcasting/levels/${L}/perDayOverride`, { type: 'num', aria: 'Per day override' })}</label>
          ${pips}
          <span class="spacer" style="flex:1"></span>
          <button class="btn small" data-action="add-spell" data-l="${L}">+ Spell</button></header>
        ${rows || '<p class="small muted" style="margin:0">No spells listed.</p>'}</div>`;
    }).join('');
    const levels = card('Spells', `<div class="grid two">${blocks || '<p class="muted">Pick a casting class above, or tick "Show all levels".</p>'}</div>`, { cls: 'span-2' });

    const sla = card('Spell-like Abilities', sc.sla.map((g, gi) => `<h3 style="margin:8px 0 4px">${esc(g.label)}</h3>
      ${g.items.map((it, i) => `<div class="spell-row" style="grid-template-columns: 60px 1fr auto 28px">
        ${inp(`spellcasting/sla/${gi}/items/${i}/uses`, { ph: 'uses', aria: 'Uses' })}${inp(`spellcasting/sla/${gi}/items/${i}/name`, { ph: 'Ability', aria: 'Name' })}
        <button class="btn small" data-action="cast-sla" data-g="${gi}" data-i="${i}">Use</button>${removeBtn(`spellcasting/sla/${gi}/items`, i, 'ability')}</div>`).join('')}
      <button class="btn small" data-action="add-sla" data-g="${gi}">+ ${esc(g.label)}</button>`).join(''));
    const notes = card('Spellcasting Notes', area('spellcasting/notes', { rows: 8 }));
    return `<div class="grid two">${header}${levels}${sla}${notes}</div>`;
  }

  // ----- Effects
  function effectCells(listPath, i, row, auto) {
    return M.EFFECT_COLS.map(c => {
      if (auto && autoKeys(row).includes(c.key)) return `<td><span class="calc small" title="Calculated">${esc(autoValue(row, c.key))}</span></td>`;
      const v = row.v ? row.v[c.key] : '';
      return `<td><input class="n" data-bind="${listPath}/${i}/v/${c.key}" data-type="fx" value="${esc(v === undefined ? '' : v)}" aria-label="${esc(c.group + ' ' + c.label)}"${c.title ? ` title="${esc(c.title)}"` : ''}></td>`;
    }).join('');
  }
  function autoKeys(t) {
    return { powerAttack: ['mAtk', 'mDmg', 'ohDmg', 'thDmg'], combatExpertise: ['ac', 'mAtk'], deadlyAim: ['rAtk', 'rDmg'], haste: ['speed', 'fly', 'swim', 'burrow', 'climb'] }[t.auto] || [];
  }
  function autoValue(t, key) {
    const pa = Math.floor(App.d.bab / 4) + 1;
    const m = { powerAttack: { mAtk: -pa, mDmg: 2 * pa, ohDmg: -pa, thDmg: pa }, combatExpertise: { ac: pa, mAtk: -pa }, deadlyAim: { rAtk: -pa, rDmg: 2 * pa } }[t.auto];
    if (m) return sign(m[key]);
    return 'auto';
  }
  function renderEffects() {
    const ch = App.ch;
    const groups = [];
    for (const c of M.EFFECT_COLS) { const last = groups[groups.length - 1]; if (last && last.g === c.group) last.n++; else groups.push({ g: c.group, n: 1 }); }
    const head = `<thead><tr class="group-row"><th colspan="3"></th>${groups.map(g => `<th colspan="${g.n}">${esc(g.g)}</th>`).join('')}<th colspan="2"></th></tr>
      <tr><th>On</th><th class="l">Effect</th><th>Type</th>${M.EFFECT_COLS.map(c => `<th title="${esc(c.title || '')}">${esc(c.label)}</th>`).join('')}<th class="l">Skills / Initiative text</th><th></th></tr></thead>`;
    const typeSel = (p) => sel(p, M.BONUS_TYPES, { blank: false });
    const effRows = ch.effects.map((e, i) => `<tr class="${e.active ? '' : 'inactive'}">
      <td>${chk(`effects/${i}/active`, { rerender: true, aria: 'Active' })}</td>
      <td class="l" style="min-width:160px">${inp(`effects/${i}/name`, { ph: 'Belt of Giant Strength +2' })}</td>
      <td style="min-width:150px">${typeSel(`effects/${i}/type`)}</td>
      ${effectCells('effects', i, e, false)}
      <td style="min-width:180px">${inp(`effects/${i}/text`, { ph: 'Stealth +4, Initiative +2' })}</td>
      <td>${removeBtn('effects', i, 'effect')}</td></tr>`).join('');
    const totals = `<tr class="totals"><td></td><td class="l">Total (all active)</td><td></td>${M.EFFECT_COLS.map(c => `<td>${out('effectTotals/' + c.key, '', '')}</td>`).join('')}<td></td><td></td></tr>`;
    const effects = card('Effects', `<p class="small muted" style="margin-top:0">Bonuses of the same type don't stack (highest wins), penalties always stack, and Untyped, Dodge and Circumstance bonuses stack. Deflection, Enhancement and Resistance are separate types, so a ring of protection, a belt and a cloak all count. Speed accepts <span class="kbd">x0.5</span> to multiply. The text column applies a number to any skill (or Initiative) it names, e.g. <span class="kbd">Perception, Stealth +2</span>.</p>
      <div class="scroll-x"><table class="effects-table">${head}<tbody>${effRows}${totals}</tbody></table></div>`,
      { tools: `<button class="btn small" data-action="add-effect">+ Effect</button>` });

    const togRows = ch.toggles.map((t, i) => `<tr class="${t.active ? '' : 'inactive'}">
      <td>${chk(`toggles/${i}/active`, { rerender: true, aria: 'Active' })}</td>
      <td class="l" style="min-width:160px">${t.id.startsWith('custom') ? inp(`toggles/${i}/name`) : esc(t.name)}</td>
      <td style="min-width:150px">${typeSel(`toggles/${i}/type`)}</td>
      ${effectCells('toggles', i, t, true)}
      <td style="min-width:180px">${inp(`toggles/${i}/text`)}</td><td></td></tr>`).join('');
    const toggles = card('Combat Toggles', `<div class="scroll-x"><table class="effects-table">${head}<tbody>${togRows}</tbody></table></div>`);

    const where = { race: 'Race tab', trait: 'trait, Features & Gear tab', feat: 'feat, Features & Gear tab', feature: 'class feature, Features & Gear tab',
      worn: 'worn item, Features & Gear tab', item: 'magic item', condition: 'condition, Play or Combat tab' };
    const seen = new Set();
    const active = App.d.rows.filter(r => where[r.src] && !seen.has(r.src + r.name) && seen.add(r.src + r.name));
    const applied = card('Also applied (from other tabs)', active.length ? `<ul>${active.map(r => `<li><strong>${esc(r.name)}</strong> <span class="muted small">(${esc(where[r.src])})</span></li>`).join('')}</ul>`
      : '<p class="muted small">Bonuses from your race, feats, traits, class features, worn items and conditions are listed here when active.</p>');
    return `<div class="grid">${effects}${toggles}${applied}</div>`;
  }

  // ----- Features & gear
  function renderFeatures() {
    const ch = App.ch;
    const traits = card('Traits & Drawbacks', featureList('traits'),
      { tools: `<button class="btn small" data-action="add" data-list="traits">+ Trait</button>` });
    const cf = card('Class Features', featureList('classFeatures'),
      { tools: `<button class="btn small" data-action="add" data-list="classFeatures">+ Feature</button>` });
    const feats = card('Feats', featureList('feats'),
      { tools: `<button class="btn small" data-action="add" data-list="feats">+ Feat</button>` });
    const res = card('Resources', `${ch.resources.map((r, i) => `<div class="list-row res-row">${inp(`resources/${i}/name`, { ph: 'Wand of CLW, Rage rounds…' })}
        <span class="counter"><button class="btn small" data-action="bump" data-path="resources/${i}/uses" data-d="-1" aria-label="Use one">−</button>${inp(`resources/${i}/uses`, { type: 'num', aria: 'Uses' })}<span class="muted">/</span>${inp(`resources/${i}/max`, { type: 'num', aria: 'Max' })}<button class="btn small" data-action="bump" data-path="resources/${i}/uses" data-d="1" aria-label="Add one">+</button></span>
        ${removeBtn('resources', i)}</div>`).join('') || '<p class="small muted">Track charges, rounds per day, scrolls and coins here.</p>'}
      <div class="inline" style="margin-top:10px"><strong>Hero points</strong>
        <span class="counter"><button class="btn small" data-action="bump" data-path="heroPoints/current" data-d="-1">−</button>${inp('heroPoints/current', { type: 'num' })}<span class="muted">/</span>${inp('heroPoints/max', { type: 'num' })}<button class="btn small" data-action="bump" data-path="heroPoints/current" data-d="1">+</button></span></div>`,
      { tools: `<button class="btn small" data-action="add" data-list="resources">+ Resource</button>` });
    const slots = card('Magic Items Worn', featureList('slots'),
      { tools: `<button class="btn small" data-action="add" data-list="slots">+ Slot</button>` });
    const help = `<p class="small muted span-2" style="margin:0">Give a feat, trait, class feature or worn item a <strong>bonus</strong> and it changes your numbers: pick what it applies to and a value. Values can be formulas such as <span class="kbd">max(3, level)</span> (Toughness), <span class="kbd">max(1, floor(rogue/2))</span> (Trapfinding: half your rogue levels, at least 1) or <span class="kbd">ranks >= 10 ? 6 : 3</span> (Skill Focus). Click the <strong>?</strong> next to any value for the full list of variables, and the result appears beside it. <strong>Add standard bonuses</strong> fills them in for common feats, traits and magic items (belts, headbands, cloaks, rings, amulets…).</p>`;
    return `<div class="grid two">${help}${feats}${slots}${traits}${cf}${res}</div>`;
  }

  // ----- Notes
  function renderNotes() {
    const ch = App.ch;
    const story = card('Story & Notes', area('notes', { rows: 12, ph: 'Session notes, contacts, loot…' }));
    const bg = card('Background & Personality', ch.background.map((b, i) => `<div style="margin-bottom:10px">${field(b.q, area(`background/${i}/a`, { rows: 3 }))}</div>`).join(''));
    return `<div class="grid two">${story}${bg}</div>`;
  }

  // ----- Settings
  function renderSettings() {
    const s = App.settings, ch = App.ch;
    const discord = card('Discord dice rolls', `
      <p class="small">Rolls from this sheet post to a Discord channel through a webhook. In Discord: <em>Server Settings → Integrations → Webhooks → New Webhook</em>, pick the channel, then <em>Copy Webhook URL</em> and paste it here.</p>
      <div class="fields" style="grid-template-columns: 1fr">
        <label class="field">Webhook URL<input type="password" id="set-webhook" value="${esc(s.webhook || '')}" placeholder="https://discord.com/api/webhooks/…" autocomplete="off" spellcheck="false"></label>
      </div>
      <div class="fields" style="margin-top:8px">
        <label class="field">Post as (name)<input type="text" id="set-username" value="${esc(s.username || '')}" placeholder="${esc(ch.info.name || 'Character name')}"></label>
        <label class="field">Avatar image URL<input type="url" id="set-avatar" value="${esc(s.avatar || '')}" placeholder="https://… (optional)"></label>
      </div>
      <p class="inline" style="margin-top:10px"><label class="inline"><input type="checkbox" id="set-enabled"${s.enabled !== false ? ' checked' : ''}> Send rolls to Discord</label>
        <button class="btn primary" data-action="save-discord">Save</button><button class="btn" data-action="test-discord">Send test roll</button></p>
      <p class="small muted">The webhook URL is stored only in this browser and is never included in exported character files. Anyone with the URL can post to the channel, so don't share it. Shift-click any roll to keep it private.</p>`);
    const rules = card('Rules options', `<div class="fields" style="grid-template-columns: 1fr">
        ${field('Skill system', sel('settings/skillSystem', M.SKILL_SYSTEMS, { blank: false, rerender: true }))}</div>
      <p class="inline"><label class="inline">${chk('settings/woundThresholds', { rerender: true })} Unchained wound thresholds</label></p>
      <p class="inline"><label class="inline">${chk('settings/minSkillRanks', { rerender: true })} Minimum 4 + Int skill ranks per level</label></p>`);
    const data = card('Character file', `<p class="small">Characters save automatically in this browser. Export a file to back up, move to another device, or share with your GM.</p>
      <p class="inline"><button class="btn" data-action="export">Export .json</button><button class="btn" data-action="import">Import .json or .xlsx</button>
      <button class="btn" data-action="duplicate">Duplicate</button><button class="btn danger" data-action="delete-char">Delete character</button></p>
      <p class="inline small">Theme: <button class="btn small" data-action="theme" data-theme="">Auto</button><button class="btn small" data-action="theme" data-theme="light">Light</button><button class="btn small" data-action="theme" data-theme="dark">Dark</button></p>
      ${(ch.customClasses || []).length ? `<p class="small muted">Classes copied from your spreadsheet: ${ch.customClasses.map(c => esc(c.name)).join(', ')}.</p>` : ''}
      <p class="small muted">Based on the Pathfinder Autosheet v6.2.1 by /u/darthmarth28 (free for non-commercial use). Class tables: ${D.classes.length} classes.</p>`);
    return `<div class="grid two">${discord}${rules}${data}</div>`;
  }

  // ---------- Events ----------
  function coerce(el) {
    const t = el.dataset.type;
    if (t === 'bool') return el.checked;
    if (t === 'num') { if (el.value === '') return ''; const x = parseFloat(el.value); return Number.isFinite(x) ? x : ''; }
    if (t === 'numOrText') { const x = parseFloat(el.value); return /^-?\d+(\.\d+)?$/.test(el.value) ? x : el.value; }
    if (t === 'fx') {
      const v = el.value.trim();
      if (v === '') return undefined;
      if (/^x\s*\d*\.?\d+$/i.test(v)) return v.replace(/\s+/g, '').toLowerCase();
      const x = parseFloat(v);
      return Number.isFinite(x) ? x : undefined;
    }
    return el.value;
  }
  function applyBind(el) {
    if (!App.ch) return;
    const path = el.dataset.bind;
    const val = coerce(el);
    if (el.dataset.type === 'fx' && val === undefined) {
      const keys = path.split('/'); const k = keys.pop(); const obj = pathGet(App.ch, keys.join('/'));
      if (obj) delete obj[k];
    } else pathSet(App.ch, path, val);
    recompute();
    scheduleSave();
  }

  document.addEventListener('input', e => {
    if (e.target.id === 'play-skill-filter') {
      App.skillFilter = e.target.value;
      const q = App.skillFilter.trim().toLowerCase();
      $$('.skill-cell').forEach(c => { c.hidden = !!q && !c.dataset.skillName.includes(q); });
      return;
    }
    const el = e.target;
    if (!el.dataset || !el.dataset.bind) return;
    if (el.tagName === 'SELECT' || el.type === 'checkbox') return; // handled on change
    applyBind(el);
    updateOutputs();
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'add-condition' && el.value) { App.ch.conditions.push(el.value); changed(true); return; }
    // Typing an item into an empty slot: show its bonus buttons once the field is left
    if (el.dataset && el.dataset.rerenderBlur !== undefined) { render(); return; }
    if (!el.dataset || !el.dataset.bind) return;
    if (!(el.tagName === 'SELECT' || el.type === 'checkbox')) return;
    applyBind(el);
    if (el.hasAttribute('data-rerender') || el.closest('.chip')) render(); else updateOutputs();
  });

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const priv = e.shiftKey;
    const handlers = {
      'tab': () => { App.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
      'new-char': () => newCharacter(),
      'import': () => $('#file-input').click(),
      'export': () => exportCharacter(),
      'duplicate': () => { const c = JSON.parse(JSON.stringify(App.ch)); c.id = M.uid(); c.info.name = (c.info.name || 'Character') + ' (copy)'; adoptCharacter(c); toast('Duplicated.'); },
      'delete-char': () => deleteCharacter(),
      'theme': () => { setTheme(el.dataset.theme); },
      'add-class': () => { App.ch.classes.push({ name: '', level: 0 }); changed(true); },
      'add-specialty': () => { App.ch.specialty.push({ base: 'Craft:', detail: '', ranks: 0, misc: 0 }); changed(true); },
      'add-weapon': () => {
        App.ch.weapons.push(M.blankWeapon());
        App.tab = 'combat'; changed(true);
        const cards = $$('.weapon'); const last = cards[cards.length - 1];
        if (last) { last.scrollIntoView({ block: 'center' }); const n = last.querySelector('input'); if (n) n.focus(); }
      },
      'apply-race': () => applyRacePreset($('#race-preset').value),
      'add-bonus': () => {
        const list = get(el.dataset.list);
        const b = { label: '', type: el.dataset.type || 'Untyped (stacks)', target: 'skill', skill: '', weapon: '', value: '', text: '', active: true };
        if (Array.isArray(list)) list.push(b); else pathSet(App.ch, el.dataset.list, [b]);
        changed(true);
      },
      'suggest-bonus': () => suggestBonuses(el.dataset.list, +el.dataset.i, el.dataset.kind),
      'add-effect': () => { App.ch.effects.push(M.blankEffect('', 'Untyped (stacks)')); changed(true); },
      'add-spell': () => { App.ch.spellcasting.levels[+el.dataset.l].spells.push({ name: '', prepared: '' }); changed(true); },
      'add-sla': () => { App.ch.spellcasting.sla[+el.dataset.g].items.push({ name: '', uses: '' }); changed(true); },
      'add': () => {
        const blanks = { traits: { kind: 'Trait', text: '', bonuses: [] }, racialFeatures: { name: '', text: '' }, classFeatures: { name: '', text: '', bonuses: [] },
          feats: { level: '', name: '', text: '', bonuses: [] }, resources: { name: '', uses: '', max: '' }, slots: { slot: '', item: '', bonuses: [] }, };
        App.ch[el.dataset.list].push(blanks[el.dataset.list]); changed(true);
      },
      'remove': () => { const arr = get(el.dataset.list); if (Array.isArray(arr)) { arr.splice(+el.dataset.i, 1); changed(true); } },
      'toggle-condition': () => {
        const n = el.dataset.name, c = App.ch.conditions, i = c.indexOf(n);
        if (i >= 0) c.splice(i, 1); else c.push(n);
        changed(true);
      },
      'bump': () => { const p = el.dataset.path; const v = (parseFloat(get(p)) || 0) + (+el.dataset.d); pathSet(App.ch, p, Math.max(0, v)); changed(true); },
      'hp': () => hpAction(el.dataset.mode),
      'pip': () => {
        const lv = App.ch.spellcasting.levels[+el.dataset.l], k = +el.dataset.k;
        lv.used = (lv.used || 0) > k ? k : k + 1; changed(true);
      },
      'toggle-all-levels': () => { App.showAllSpellLevels = el.checked; render(); },
      'rest': () => restAction(),
      'roll-check': () => rollCheck(el.dataset.label, dget(el.dataset.mod), priv),
      'attack': () => rollAttack(+el.dataset.i, el.dataset.mode, priv),
      'cast': () => castSpell(+el.dataset.l, +el.dataset.i, priv),
      'cast-sla': () => castSla(+el.dataset.g, +el.dataset.i, priv),
      'roll-expr': () => rollFree($('#dice-expr').value, priv),
      'quick-die': () => rollFree(el.dataset.expr, priv),
      'save-discord': () => saveDiscordSettings(true),
      'test-discord': () => { saveDiscordSettings(false); rollCheck('Test roll', 0, false, true); },
      'clear-log': () => { App.log = []; lsSet(LS.log, []); renderLog(); },
    };
    if (handlers[a]) { if (el.tagName === 'BUTTON' || el.tagName === 'A') e.preventDefault(); handlers[a](); }
  });

  function changed(rerender) { recompute(); scheduleSave(); if (rerender) render(); else updateOutputs(); }

  $('#roster') && $('#roster').addEventListener('change', e => { saveNow(); loadCharacter(e.target.value); });
  $('#dice-expr').addEventListener('keydown', e => { if (e.key === 'Enter') rollFree(e.target.value, e.shiftKey); });

  // ---------- Actions ----------
  function newCharacter() {
    if (App.ch) saveNow();
    const ch = M.blankCharacter();
    ch.info.name = 'New character';
    App.ch = ch; App.tab = 'character';
    saveNow(); recompute(); render();
  }
  function deleteCharacter() {
    if (!confirm(`Delete "${App.ch.info.name || 'this character'}" from this browser? Export it first if you want a copy. This can't be undone.`)) return;
    lsDel(LS.char(App.ch.id));
    App.roster.ids = App.roster.ids.filter(x => x !== App.ch.id);
    App.ch = null;
    const next = App.roster.ids[0];
    lsSet(LS.roster, { ids: App.roster.ids, current: next || null });
    if (!next || !loadCharacter(next)) { App.d = null; render(); }
  }
  function exportCharacter() {
    const blob = new Blob([JSON.stringify(App.ch, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (App.ch.info.name || 'character').replace(/[^\w\- ]+/g, '').trim() + '.pfsheet.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importFile(file) {
    try {
      let ch, warnings = [];
      if (/\.json$/i.test(file.name)) {
        ch = JSON.parse(await file.text());
        if (!ch || !ch.info || !ch.abilities) throw new Error('That JSON file is not a character exported from this sheet.');
      } else if (/\.xlsx$/i.test(file.name)) {
        const res = window.PF_IMPORT.importXlsxBuffer(await file.arrayBuffer());
        ch = res.character; warnings = res.warnings;
      } else throw new Error('Choose a .xlsx (Google Sheets download) or a .json file exported from this sheet.');
      if (App.ch) saveNow();
      if (!ch.id || App.roster.ids.includes(ch.id)) ch.id = M.uid();
      App.tab = 'play';
      adoptCharacter(ch);
      showImportResult(ch, warnings);
    } catch (err) {
      console.error(err);
      alert('Import failed: ' + err.message);
    }
  }
  function showImportResult(ch, warnings) {
    const dlg = $('#import-dialog');
    $('#import-body').innerHTML = `<p>Imported <strong>${esc(ch.info.name || 'character')}</strong>.</p>` +
      (warnings.length ? `<p>Check these:</p><ul class="warn-list">${warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p class="muted">No problems found.</p>') +
      `<p class="small muted">Compare a few totals (AC, saves, attacks) with your spreadsheet. Notes and formatting the importer doesn't recognize are left out.</p>`;
    dlg.showModal();
  }
  function hpAction(mode) {
    const amt = Math.abs(parseFloat($('#hp-amount').value) || 0);
    if (!amt) { toast('Enter an amount first.'); return; }
    const hp = App.ch.hp;
    if (mode === 'damage') {
      let left = amt;
      const t = Math.min(hp.temp || 0, left); hp.temp = (hp.temp || 0) - t; left -= t;
      hp.damage = (Math.abs(hp.damage) || 0) + left;
    } else if (mode === 'heal') {
      hp.damage = Math.max(0, (Math.abs(hp.damage) || 0) - amt);
      hp.nonlethal = Math.max(0, (hp.nonlethal || 0) - amt);
    } else if (mode === 'nonlethal') hp.nonlethal = (hp.nonlethal || 0) + amt;
    else if (mode === 'temp') hp.temp = Math.max(hp.temp || 0, amt);
    $('#hp-amount').value = '';
    changed(true);
  }
  function restAction() {
    if (!confirm('Rest: clear used spell slots and refill resources to their max?')) return;
    App.ch.spellcasting.levels.forEach(l => { l.used = 0; });
    App.ch.resources.forEach(r => { if (r.max !== '' && r.max !== undefined) r.uses = r.max; });
    App.ch.hp.nonlethal = 0;
    changed(true);
    toast('Rested.');
  }

  // ---------- Rolling ----------
  function who() { return App.ch ? (App.ch.info.name || 'Unnamed') : 'Dice'; }
  function rollCheck(label, mod, priv, test) {
    if (mod === null || mod === undefined) { toast(label + ' needs ranks to roll (trained only).'); return; }
    const r = DICE.check(mod);
    const lines = [`1d20 (${r.nat}) ${DICE.signed(mod)}`];
    if (r.nat === 20) lines.push('Natural 20!');
    if (r.nat === 1) lines.push('Natural 1.');
    emit({ title: `${who()}: ${label}${test ? ' (test)' : ''}`, total: r.total, lines, crit: r.nat === 20, fumble: r.nat === 1 }, priv);
  }
  function rollFree(expr, priv) {
    try {
      const r = DICE.rollExpr(expr);
      emit({ title: `${who()}: ${expr.replace(/\s+/g, '')}`, total: r.total, lines: [r.text] }, priv);
    } catch (e) { toast(e.message); }
  }
  function rollAttack(i, mode, priv) {
    const w = App.ch.weapons[i], d = App.d.weapons[i];
    if (!d || !d.valid) { toast('Pick an attack type and formula for this weapon first.'); return; }
    const low = DICE.critLow(w.crit), mult = DICE.critMult(w.mult);
    const name = w.name || 'Attack';
    const hasDmg = d.damageBonus !== null || !!d.damageOverride;
    const rollDmg = (m) => d.damageOverride ? overrideDamage(d.damageOverride, m) : DICE.damage(w.dice, d.damageBonus, m);
    if (mode === 'damage') {
      if (!hasDmg) { toast('This attack has no damage formula.'); return; }
      const dm = rollDmg(1);
      emit({ title: `${who()}: ${name} damage`, total: dm.total, lines: [dm.text + (w.type ? ` (${w.type})` : '')] }, priv);
      return;
    }
    const bonuses = mode === 'single' ? d.attacks.slice(0, 1) : d.attacks;
    const lines = [];
    let anyCrit = false, anyFumble = false, dmgTotal = 0;
    bonuses.forEach((b, k) => {
      const r = DICE.check(b);
      let line = `**Attack ${bonuses.length > 1 ? k + 1 : ''}: ${r.total}** (d20 ${r.nat} ${DICE.signed(b)})`.replace('Attack :', 'Attack:');
      let critConfirmed = false;
      if (r.nat === 1) { line += ' natural 1, miss'; anyFumble = true; }
      else if (r.nat >= low) {
        const c = DICE.check(b);
        critConfirmed = c.nat !== 1;
        line += ` threat! confirm ${c.total} (d20 ${c.nat})`;
        anyCrit = true;
      }
      if (hasDmg && r.nat !== 1) {
        const normal = rollDmg(1);
        line += ` · dmg **${normal.total}** (${normal.text})`;
        dmgTotal += normal.total;
        if (r.nat >= low) {
          const crit = rollDmg(mult);
          line += ` · if confirmed: **${crit.total}** (x${mult}: ${crit.text})`;
        }
      }
      lines.push(line);
    });
    if (w.type) lines.push(`Damage type: ${w.type}`);
    emit({ title: `${who()}: ${name}${mode === 'full' && bonuses.length > 1 ? ' (full attack)' : ''}`, total: null, lines, crit: anyCrit, fumble: anyFumble && !anyCrit }, priv);
  }
  function overrideDamage(expr, times) {
    let total = 0; const parts = [];
    for (let k = 0; k < times; k++) { const r = DICE.rollExpr(expr); total += r.total; parts.push(r.text); }
    return { total, text: parts.join(' + ') };
  }
  function castSpell(L, i, priv) {
    const s = App.ch.spellcasting.levels[L].spells[i];
    if (!s || !s.name) { toast('Name the spell first.'); return; }
    const lv = App.ch.spellcasting.levels[L];
    const perDay = App.d.spells.levels[L].perDay;
    if (L > 0 && typeof perDay === 'number' && (lv.used || 0) < perDay) lv.used = (lv.used || 0) + 1;
    changed(true);
    const dcv = App.d.spells.levels[L].dc;
    emit({ title: `${who()} casts ${s.name}`, total: null, kind: 'info', lines: [`Level ${L} spell · DC ${dcv} · CL ${App.d.spells.cl}`] }, priv);
  }
  function castSla(g, i, priv) {
    const it = App.ch.spellcasting.sla[g].items[i];
    if (!it || !it.name) { toast('Name the ability first.'); return; }
    if (/^\d+$/.test(String(it.uses)) && +it.uses > 0) { it.uses = String(+it.uses - 1); changed(true); }
    emit({ title: `${who()} uses ${it.name}`, total: null, kind: 'info', lines: [`Spell-like ability (${App.ch.spellcasting.sla[g].label})`] }, priv);
  }

  async function emit(roll, priv) {
    const entry = Object.assign({ id: M.uid(), ts: Date.now(), private: !!priv, status: '' }, roll);
    App.log.unshift(entry);
    App.log = App.log.slice(0, 60);
    const s = App.settings;
    const send = !priv && s.enabled !== false && DC.isWebhook(s.webhook);
    entry.status = priv ? 'Private roll' : (send ? 'Sending to Discord…' : (s.webhook ? 'Discord off' : 'Not sent (no webhook set)'));
    renderLog();
    popRoll(entry);
    if (send) {
      const res = await DC.send(s.webhook, entry, { username: s.username || entry.title.split(':')[0].replace(/ (casts|uses) .*$/, ''), avatar: s.avatar });
      entry.status = res.ok ? 'Sent to Discord' : res.error;
      entry.err = !res.ok;
      renderLog();
      if (!$('#roll-pop').classList.contains('hidden')) popRoll(entry);
    }
    lsSet(LS.log, App.log.slice(0, 30).map(x => Object.assign({}, x)));
  }
  let popTimer = null;
  function logEntryHtml(x) {
    return `<div class="log-entry${x.crit ? ' crit' : ''}${x.fumble ? ' fumble' : ''}">
      <div class="title"><span>${esc(x.title)}</span>${x.total !== null && x.total !== undefined ? `<span class="total">${esc(x.total)}</span>` : ''}</div>
      <div class="detail">${x.lines.map(l => esc(l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')).join('\n')}</div>
      <div class="status${x.err ? ' err' : ''}">${new Date(x.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${esc(x.status)}</div></div>`;
  }
  function popRoll(x) {
    let el = $('#roll-pop');
    if (!el) { el = document.createElement('div'); el.id = 'roll-pop'; el.className = 'roll-pop'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = logEntryHtml(x); el.classList.remove('hidden');
    clearTimeout(popTimer); popTimer = setTimeout(() => el.classList.add('hidden'), 7000);
  }
  function renderLog() {
    const el = $('#log');
    el.innerHTML = App.log.map(logEntryHtml).join('') ||
      '<p class="small muted">Click any 🎲 value to roll it. Shift-click rolls privately.</p>';
  }
  function renderDiscordState() {
    const s = App.settings, on = s.enabled !== false && DC.isWebhook(s.webhook);
    $('#discord-state').innerHTML = `<span class="dot${on ? ' on' : ''}"></span>${on ? 'Rolls post to Discord' : 'Discord not connected'}`;
  }
  function saveDiscordSettings(announce) {
    const url = $('#set-webhook').value.trim();
    if (url && !DC.isWebhook(url)) { toast('That does not look like a Discord webhook URL.'); return; }
    App.settings.webhook = url;
    App.settings.username = $('#set-username').value.trim();
    App.settings.avatar = $('#set-avatar').value.trim();
    App.settings.enabled = $('#set-enabled').checked;
    lsSet(LS.settings, App.settings);
    renderDiscordState();
    if (announce) toast('Discord settings saved.');
  }

  // ---------- Misc UI ----------
  let toastTimer = null;
  function toast(msg) {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  }
  function setTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
    App.settings.theme = t || ''; lsSet(LS.settings, App.settings);
  }

  // File input & drag-drop
  $('#file-input').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
  document.addEventListener('dragover', e => { e.preventDefault(); const z = $('#drop-zone'); if (z) z.classList.add('over'); });
  document.addEventListener('dragleave', e => { const z = $('#drop-zone'); if (z && e.target === z) z.classList.remove('over'); });
  document.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) importFile(f); });
  window.addEventListener('beforeunload', () => { if (App.ch) saveNow(); });

  // ---------- Boot ----------
  function boot() {
    App.settings = lsGet(LS.settings, {}) || {};
    if (App.settings.theme) document.documentElement.setAttribute('data-theme', App.settings.theme);
    App.roster = lsGet(LS.roster, { ids: [], current: null }) || { ids: [], current: null };
    App.roster.ids = (App.roster.ids || []).filter(id => lsGet(LS.char(id), null));
    App.log = lsGet(LS.log, []) || [];
    renderLog();
    const id = App.roster.current && App.roster.ids.includes(App.roster.current) ? App.roster.current : App.roster.ids[0];
    if (!id || !loadCharacter(id)) render();
  }
  window.PF_APP = App;
  boot();
})();
