# PF Autosheet (web)

A browser version of the **Pathfinder Autosheet v6.2.1** Google Sheet (Pathfinder 1e), with dice rolls that post to a Discord channel.

It is plain HTML, CSS and JavaScript with no build step and no server. Characters are saved in the browser and can be exported as `.json` files.

## Running it

Any static web server works. From this folder:

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000>. To share it with your group, put the folder on any static host (GitHub Pages, Netlify, Cloudflare Pages). Each player's characters stay in their own browser.

Opening `index.html` straight from disk mostly works, but browsers treat `file://` pages oddly. Serve it if Discord posting or import gives you trouble.

Internet access is needed for two things: the spreadsheet reader used by `.xlsx` import (SheetJS, from jsDelivr) and the heading font.

## Importing a character from Google Sheets

1. Open the character's Autosheet in Google Sheets.
2. **File → Download → Microsoft Excel (.xlsx)**.
3. In the web sheet, click **Import** (or drag the file onto the page).

The importer reads:
- identity, classes and favored-class bonuses
- abilities, HP, saves and AC
- skill ranks, including class skills you marked by hand
- weapons and armor
- magic item bonuses (the sheet's "Magic Item or Feature" rows become rows on the Effects tab)
- the effect table, toggles and conditions
- spells, spell-like abilities, traits, features and feats
- resources, item slots and background answers

It finds each section by its label, so sheets with inserted rows still import.

It also copies over things you changed in your own copy of the sheet:
- **Custom classes** you added to *Class Charts* or *Class Skills*, including their spell tables.
- **Custom attack formulas** you added to *Formula References*.
- **Numbers typed over formulas**, such as spells per day or weapon damage. These become overrides.

When the import finishes, a dialog lists anything that needs checking.

Tested against three real character sheets, including one with a custom class and inserted rows. Every checked value matches the spreadsheet: ability scores, HP, saves, AC, CMD, initiative, skill totals, attacks, damage, speed, spells per day and caster level.

## Discord rolls

1. In Discord: **Server Settings → Integrations → Webhooks → New Webhook**. Choose the channel and copy the webhook URL.
2. In the web sheet: **Settings → Discord dice rolls**. Paste the URL, optionally set a name and avatar, then **Save** and **Send test roll**.

Click any 🎲 value to roll it: abilities, saves, skills, initiative, CMB, caster level, concentration, or a weapon's full attack, single attack or damage. Each roll appears in the roll log and posts to the channel. **Shift-click** rolls privately.

Attack rolls flag crit threats from the weapon's crit range, roll the confirmation, and show both normal and critical damage. The dice box takes any expression, such as `2d6+1d4+3`.

The webhook URL is stored only in this browser. It is never written into exported character files. Anyone who has the URL can post to that channel.

## Tabs

- **Play:** everything you need at the table on one page: HP with damage/heal buttons, AC/touch/flat-footed/CMD, initiative, saves, ability checks, attacks, buffs and conditions, all skills (with a filter), spells with slot tracking and cast buttons, resources, and a list of active bonuses and situational reminders.
- **Character:** identity, classes, ability scores, HP settings, and the full save and AC breakdowns.
- **Companion:** animal companions, eidolons, familiars and other creatures (cohorts, constructs, mounts). Each one also gets a card on the Play tab with HP, defenses, saves, attacks, skills and resources; its rolls post under its own name.
- **Race, Skills, Combat, Spells, Effects, Features & Gear, Notes, Settings:** the detailed editors.

## What's automated (same rules as the spreadsheet)

- **Classes:** 213 classes from Class Charts, covering base, hybrid, occult, monstrous, prestige, Eberron prestige, NPC and the third-party sets. HD, BAB, saves, skill ranks and class skills come from them.
- **Race:** a Race tab with racial ability modifiers (including the flexible +2), size, speed, senses, bonus skill ranks per level, racial bonuses to saves, skills, AC, attacks or initiative, and racial features. One-click presets for the seven core races (Dwarf, Elf, Gnome, Half-Elf, Half-Orc, Halfling, Human), all editable.
- **Feats, traits, class features and worn magic items:** each can carry bonuses that change your numbers: skills, saves, AC, natural armor, CMD, CMB, max HP, initiative, attack and damage (all, melee, ranged, or one named weapon), caster level and speed. Values can be formulas using `level`, `bab`, ability modifiers, `ranks`, `class1`/`class2`/`class3` (levels in each class slot) or a class name such as `rogue` or `machine_smith` (your levels in that class), e.g. `max(3, level)` for Toughness, `max(1, floor(rogue/2))` for Trapfinding or `ranks >= 10 ? 6 : 3` for Skill Focus. The **?** beside each value explains the variables, and the result shows next to the field. **Add standard bonuses** fills them in for common feats (Toughness, Improved Initiative, Iron Will, Skill Focus, Weapon Focus, Dodge, the +2/+2 skill feats…) traits (Reactionary, Resilient…) and magic items (belts and headbands of ability scores, cloaks of resistance, rings of protection, amulets of natural armor, bracers of armor, skill items like Eyes of the Eagle). An item's enhancement bonus to an ability doesn't add on top of the same amount typed in the ability's Enhance column. Situational ones become reminders on the Play tab.
- **Companions:** *Animal Companion* follows the Core Rulebook table by effective druid level (HD, BAB, saves, natural armor, Str/Dex bonus, tricks, feats, special abilities). *Eidolon* follows the APG summoner table (HD d10, full BAB, two good saves from the base form, armor bonus, Str/Dex bonus, evolution pool, max attacks), with an evolutions list tracked against the pool. *Familiar* uses half your HP, your BAB, the better of its or your base saves, and natural armor/Int/abilities by your level. *Other* lets you set HD, hit die, BAB progression and good saves. Abilities can be "-" (no score, e.g. a construct's Con). Attacks support count, primary/secondary, Str multiplier, iteratives, Multiattack and Power Attack. Companions use the same bonus system as the character: buffs (with presets such as Bless, Haste, Mage Armor, Barkskin, Bull's Strength, Shield of Faith), feats, gear and eidolon evolutions can carry typed bonuses, conditions apply to them, and they get their own Active Bonuses and Not-stacking lists. In companion formulas `level` is the companion's HD and class names are your class levels (e.g. `druid`). Unchained summoner eidolons use different numbers; model those with *Other*.
- **HP:** all six HP formulas, Con, favored-class HP, damage/temp/nonlethal tracking and negative levels.
- **Abilities:** age modifiers, enhancement vs. effect bonuses, inherent bonuses and penalties.
- **Effect table:** bonuses of the same type don't stack, while penalties and Untyped, Dodge and Circumstance bonuses do. Deflection, Enhancement and Resistance are separate types. Effects reach AC, saves, abilities, attacks, damage, caster level, extra attacks, size, speed and skills. The free-text column applies to named skills and Initiative.
- **Combat toggles:** Power Attack, Combat Expertise and Deadly Aim scale with BAB. Heroism, Haste, Rapid Shot, Studied Target, and three custom toggles.
- **Conditions:** the sheet's conditions table, plus Unchained wound thresholds.
- **Defenses:** AC, touch, flat-footed and CMD, with armor and shield tables, special materials, max Dex, armor check penalty, spell failure and encumbrance.
- **Attacks:** all attack types from Formula References (melee, ranged, off-hand, maneuvers, magic, flurry, natural, bombs, kineticist) with iterative attacks, plus INT and CHA to-hit versions with the usual damage choices (STR, STR×1.5, STR×½, the same ability, DEX or none). The Formula dropdown groups options by the ability used to hit.
- **Skills:** Standard, Background, Consolidated and Psionics skill systems; trained-only, armor check, size, Fly maneuverability, and climb/swim speed bonuses.
- **Spellcasting:** spells per day from the class tables plus ability bonus spells, spells known, DCs, caster level, concentration, slot tracking and a **Rest** button.

## Differences from the spreadsheet

These are small fixes, chosen to follow the Core Rulebook where the sheet's formulas fell short:

- The sheet's single "Deflect/Enhance/Resist" type is split into **Deflection**, **Enhancement** and **Resistance**, which stack with each other. An Enhancement bonus on AC (such as Magic Vestment) replaces the armor's own enhancement if it's higher. Imported and older saved characters are converted automatically: AC becomes Deflection, saves become Resistance, and anything else becomes Enhancement.

- Negative levels also apply to Fortitude saves. The sheet left Fort out.
- Wound thresholds also apply to Fortitude and skills, matching the Unchained rule text.
- The effect table's **CL** column adds to caster level. The sheet computed it but never used it.
- The ranged **1stA** column applies to the first ranged attack. The sheet ignored it.
- Spells known reads the correct column. The sheet was off by one.
- Rapid Bomb uses normal iterative attacks.
- Haste only adds speed to movement modes you have.
- Deafened's −4 Initiative applies.

Not ported:
- the Welcome page links
- the companion item-slot table
- the Equipment Tracker / AutoSpellcasting links (`IMPORTRANGE`)
- the spell colour-coding conventions

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Page shell |
| `css/sheet.css` | Styles (light and dark) |
| `js/data.js` | Class, skill, armor, condition and attack tables, generated from the spreadsheet |
| `js/attacks-extra.js` | Extra attack formulas (INT and CHA to hit) added on top of the spreadsheet's list |
| `js/model.js` | Character data model and defaults |
| `js/companion.js` | Companion rules (animal companion, eidolon, familiar tables) and calculations |
| `js/engine.js` | Calculations: a port of the sheet's formulas |
| `js/import.js` | `.xlsx` importer |
| `js/dice.js` | Dice expressions, checks, crits |
| `js/discord.js` | Webhook posting |
| `js/app.js` | Interface, saving, rolling |
| `tools/extract.py` | Regenerates `js/data.js` from an Autosheet `.xlsx` |
| `tools/dump_cells.py`, `tools/verify.js` | Compares the web sheet's math with a real character's spreadsheet |

Before pushing an update, run `python tools/stamp.py`. It adds a version to the CSS and JS links in `index.html` so browsers load the new files instead of cached ones (GitHub Pages lets browsers cache for 10 minutes).

To regenerate the tables after editing the master sheet's Class Charts (requires `openpyxl`):

```powershell
python tools/extract.py "Pathfinder Autosheet (v6.2.1).xlsx" js/data.js
```

To check a character's numbers against their spreadsheet:

```powershell
python tools/dump_cells.py Character.xlsx cells.json
```

```powershell
node tools/verify.js cells.json
```

## Possible next steps

- **Discord bot:** slash commands like `/roll stealth` that read the character. This needs a small always-on host. The character JSON is ready for it.
- **Shared party storage:** a GM can see everyone's sheets live. This needs a backend.

## Credits

Based on the Pathfinder Autosheet v6.2.1 by /u/darthmarth28. That sheet is free for non-commercial use and may not be rehosted as someone else's work, so keep this credit if you share the web version.
