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

Internet access is needed for two things: the spreadsheet reader used by `.xlsx` import (SheetJS, from jsDelivr) and the heading font. The rules data for autofill (`data/srd/`) ships with the site and loads only when a tab needs it.

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
- the effect table, combat toggles (as effects) and conditions
- spells, spell-like abilities, traits, features and feats
- resources, item slots and background answers

It finds each section by its label, so sheets with inserted rows still import.

It also copies over things you changed in your own copy of the sheet:
- **Custom classes** you added to *Class Charts* or *Class Skills*, including their spell tables.
- **Custom attack formulas** you added to *Formula References*.
- **Numbers typed over formulas**, such as spells per day or weapon damage. These become overrides.

When the import finishes, a dialog lists anything that needs checking.

Tested against three real character sheets, including one with a custom class and inserted rows. Every checked value matches the spreadsheet: ability scores, HP, saves, AC, CMD, initiative, skill totals, attacks, damage, speed, spells per day and caster level.

Spreadsheet imports also use the sheet's own systems: the race is recognized, class choices are picked up from feature names like *Domain: Luck*, the SRD adds the class features you've earned plus domain and bloodline powers and bonus spells, empty feat, trait and worn-item descriptions get their rules text, and spells are set up. No bonuses are added, since the spreadsheet's numbers already include them, so every total stays the same.

## Importing from Hero Lab

Click **Import** (or drag the file onto the page) and choose a Hero Lab portfolio (`.por`, in *Documents/Hero Lab/portfolios/pathfinder*) or a Hero Lab XML export. Every character in the portfolio is imported. The import uses the sheet's systems too: race, archetypes, class choices recognized from the abilities Hero Lab lists (rage powers, talents, domains, revelations…), SRD class features with their standard bonuses (merged with Hero Lab's, which keep their names and current numbers), Rage and Smite effects, item bonuses, feat and trait text and spell setup. Item properties Hero Lab lists as abilities (ghost touch, boots of speed) are left out. Then every total is matched to Hero Lab as before. Older portfolios (Hero Lab 4 and 5, saved as plain XML) work too: their details come from the text statblock and Hero Lab's skill-rank records, and the rules data fills in gear weights, prices and feat and trait text the statblock leaves out.

It brings over identity, classes, ability scores, skills (ranks and class skills), feats with their text, class abilities with their text, traits, weapons (dice, crit, range, attack type), armor and shield, worn magic items in their slots with their bonuses, other gear with weights and prices, money, tracked resources, damage reduction, languages and the character's description. A barbarian also gets a **Rage** effect to switch on.

Some things Hero Lab has switched on become effects you can switch off: Haste (from the doubled first attack), Smite Evil and Vindicator's Shield (from the AC breakdown). Divine Grace becomes a permanent Charisma bonus on saves. Prepared spells come in with their counts, spells already cast today count as used, and prestige class caster levels (Holy Vindicator and similar) are matched to Hero Lab's spells per day and caster level. If Hero Lab's load is lighter than the gear adds up to (a handy haversack's contents weigh nothing), encumbrance is set to Hero Lab's load. After importing, the sheet compares its own totals with Hero Lab's (abilities, HP, saves, AC, initiative, every attack and skill). Conditions Hero Lab has on (shaken, fatigued…) are switched on here too. Anything still different, such as an oversized weapon or favored-class HP, becomes a labelled bonus on one effect row, **Import adjustments (Hero Lab)**, on the Effects tab: click its bonus count to see, edit or remove each one, or switch off or delete the whole row. Companions' data inside the portfolio is never mixed into the character; spells are set up from the SRD automatically.

**Companions in the portfolio** come in too. A familiar, animal companion or eidolon is added to the character's Companion tab with its abilities, natural armor, feats (with their usual bonuses), skills, attacks (Weapon Finesse is recognized from the numbers), senses, resistances, speeds (fly, swim…), special abilities, tracked uses, languages and damage taken. Its AC, HP, saves, initiative, attacks and skills are matched to Hero Lab through the companion's misc fields; CMB and CMD differences (a Tiny creature using Dex) go on an editable buff, **Import adjustments (Hero Lab)**. A cohort or follower with class levels is imported as a character of its own, since it needs the full sheet: it appears in the character list at the top, and its notes say whose cohort it is. The leader opens first after the import.

## Discord rolls

1. In Discord: **Server Settings → Integrations → Webhooks → New Webhook**. Choose the channel and copy the webhook URL.
2. In the web sheet: **Settings → Discord dice rolls**. Paste the URL, optionally set a name and avatar, then **Save** and **Send test roll**.

Click any 🎲 value to roll it: abilities, saves, skills, initiative, CMB, caster level, concentration, or a weapon's full attack, single attack or damage. Each roll appears in the roll log and posts to the channel. **Shift-click** rolls privately.

Attack rolls flag crit threats from the weapon's crit range, roll the confirmation, and show both normal and critical damage. The dice box takes any expression, such as `2d6+1d4+3`.

The webhook URL is stored only in this browser. It is never written into exported character files. Anyone who has the URL can post to that channel.

## Tabs

- **Play:** everything you need at the table on one page: HP with damage/heal buttons, AC/touch/flat-footed/CMD, initiative, saves, ability checks, attacks, buffs and conditions, all skills (with a filter), spells with slot tracking and cast buttons, and resources. **Active Bonuses** (what's adding to your numbers, bonuses that don't stack, situational reminders, senses and languages) sits in the sidebar under Dice, so it shows on every tab. **Situational** switches (◐) sit under the effects in Buffs & Conditions: one per feat, trait, class feature, racial trait or worn item whose bonus only applies sometimes (Point-Blank Shot, a dwarf's Hatred and Hardy, Inspire Courage, Favored Enemy, Mobility…). Switch one on while it applies and the numbers change; hover for when it applies. Companions' situational feats and gear get the same switches on their Play card.
- **Character:** identity, classes, ability scores, HP settings, the full save and AC breakdowns, traits and drawbacks, and class features (with **Add for my level**). Values that are set on another tab (race, size, racial ability modifiers, temporary bonuses, armor, shield, natural armor, deflection, dodge, speed) are links marked ↗: click one to open that tab with the cursor in the field.
- **Companion:** animal companions, eidolons, familiars and other creatures (cohorts, constructs, mounts). Each one also gets a card on the Play tab with HP, defenses, saves, attacks, skills and resources; its rolls post under its own name.
- **Feats:** your feats, each with its rules text and bonuses.
- **Folding cards:** each companion's card on the Play tab and each Gear tab card (Inventory & Encumbrance, Magic Items Worn, Misc Magic Items, Resources) folds up like an accordion: click its title or the ▾ arrow. A folded card keeps a one-line summary in its header (a companion's HP and AC; item counts, load and coins), and the sheet remembers which cards you folded in this browser.
- **Gear:** inventory, coins and encumbrance; **Magic Items Worn** (full width, one row per body slot, with each item's description and bonuses lined up under its name); **Misc Magic Items** with **Resources** beside it.
- **Misc Magic Items** (Gear tab): magic items you carry but don't wear, such as wands, staves, rods, ioun stones, a bag of holding, potions and scrolls. Each has a quantity, charges (left / most; an item with a most gets a counter in the Play tab's Resources card), weight, value, carried, a description and bonuses like a worn item. Picking a known item fills in its description, weight and price. Their weight and value count with your gear (a Magic items line in Carrying). **Collect from inventory** moves magic items already in the inventory here: anything the SRD lists as slotless, and names like "Wand of…", "Potion of…", "Scroll of…", "Staff of…" or "Ioun stone" (a scroll case or a flask of oil stays put). Imports fill it in: Hero Lab's magic items with no body slot go here, and imports from Hero Lab or the spreadsheet move recognized magic items out of the inventory.
- **Race, Skills, Combat, Spells, Effects, Notes, Settings:** the detailed editors.

## Autofill from the Pathfinder Reference Document

Name fields suggest entries as you type. Browsers show only about 500 suggestions at a time, so the list holds the names matching what you've typed, those starting with it first. Pick one (or type its exact name) and the sheet fills in the fields you left blank. Change the name later and it replaces what it filled in (text, bonuses, dice, weapon stats) with the new entry's, or clears it for a name it doesn't know. Anything you edited by hand is kept. The first entry in every list is **(Custom)**: pick it to type your own entry (homebrew, or a renamed version) with no autofill. To switch autofill back on for that row, clear the field and pick **(Use SRD list)**.

- **Feats** (yours and companions'): prerequisites and benefit text, plus the usual bonuses where the sheet knows them (Toughness, Iron Will, Skill Focus (Stealth), Weapon Focus (longsword)…).
- **Traits:** the trait's text after its name, plus the usual bonuses (Reactionary, Resilient…).
- **Class features:** kept in step automatically. Changing a class, level, archetype or class choice adds the features you've earned (with their rules text), updates numbered ones (Sneak attack +3d6 becomes +4d6) and removes ones above your level or no longer chosen, unless you edited them. **Add for my level** runs the same update by hand. Features that change numbers get their standard bonuses (Divine Grace adds Cha to saves, Fast Movement +10 ft., Nature Sense +2 Knowledge (nature) and Survival), situational ones a Play-tab switch (Bravery, Trap Sense, Favored Enemy, Inspire Courage…) or reminder (Evasion, Uncanny Dodge…), and Rage and Smite Evil an effect to switch on. The name field suggests your classes' features; picking one fills in its text and bonuses.
- **Archetypes:** pick them under each class on the Character tab (about 315 archetypes from the eight books). **Add for my level** then adds the archetype's abilities at the levels gained and removes the class features they replace (a Hospitaler paladin gets its own Smite Evil, Channel Positive Energy and Aura of Healing instead of the standard ones). Features you've edited are kept and listed. Two archetypes that replace the same feature get a warning, since they can't be combined. Hero Lab imports fill in the archetype from the class name, e.g. Paladin (Hospitaler). 
- **Class choices:** under each class, one list holds that class's choices: cleric domains and subdomains (inquisitors and druids can pick domains too), inquisitions, sorcerer and bloodrager bloodlines, arcane schools, oracle mysteries and curses, cavalier orders, witch patrons, shaman spirits, warpriest blessings, and talents such as rage powers, rogue and ninja talents, magus arcana, alchemist discoveries, witch hexes and arcanist exploits (about 730 in all). A chosen mystery or spirit adds its revelations or hexes to the list. **Add for my level** adds the powers you've reached, puts domain, bloodline, mystery, patron and spirit spells on the Spells tab (when that class is your spellcasting class), and takes out features and bonus spells for choices you've removed, unless you've edited them or given them bonuses. Gunslinger and swashbuckler deeds are added by level automatically. A subdomain uses its domain's powers and spells with its replacements. Abilities that only *change* a feature are added with a note and the base feature stays; number changes go on the feature's bonuses as usual.
- **Spells and spell-like abilities** (yours and companions'): save, duration, range and a short description; damage or healing dice that scale with caster level (Fireball becomes `min(cl, 10)` d6 fire); ranged or melee touch attacks; buff bonuses for common buffs such as Bless, Shield of Faith or Haste.
- **Weapons:** damage dice for your size (Small or Medium), crit range and multiplier, range, damage type, weight, and an attack type and formula if none is set (composite bows add Str to damage). A name like `+1 longsword` also sets the enhancement.
- **Inventory:** weight and price. Magic items with several strengths use the one in the name (`Cloak of Resistance +2` costs 4,000 gp).
- **Worn magic items:** a short description and the usual bonuses (cloak of resistance, ring of protection, belts, headbands, amulets of natural armor…), like feats. Then the item moves to its body slot's row (a cloak to shoulders, a belt to waist, a headband to headband). If that slot is taken, it gets a new row of that slot, such as a third ring. **Sort to slots** on the Magic Items Worn card does the same for items already listed, such as imported ones. Items the SRD doesn't know stay where you put them.

The data covers the Core Rulebook, Advanced Player's Guide, Ultimate Magic, Ultimate Combat, Advanced Race Guide, Advanced Class Guide, Ultimate Campaign and Ultimate Equipment: about 1,050 feats, 230 traits, 1,500 spells, 2,500 magic items, 350 goods, 200 weapons, 28 armors and 49 classes. Bestiary content, such as monster feats, isn't included.

## What's automated (same rules as the spreadsheet)

- **Classes:** 213 classes from Class Charts, covering base, hybrid, occult, monstrous, prestige, Eberron prestige, NPC and the third-party sets. HD, BAB, saves, skill ranks and class skills come from them.
- **Race:** a Race tab with racial ability modifiers (including the flexible +2), size, speed, senses, bonus skill ranks per level, racial bonuses to saves, skills, AC, attacks or initiative, and racial features. One-click presets for the seven core races (Dwarf, Elf, Gnome, Half-Elf, Half-Orc, Halfling, Human) and the 30 other Advanced Race Guide races (aasimar, tiefling, catfolk, drow, goblin, kitsune, strix, tengu and more), all editable. The extra races are read from the rules data: ability modifiers, size, speed (including fly, swim and climb), senses, languages, unconditional skill and save bonuses and natural armor become numbers; situational traits with a number ("+2 on saves against poison") become bonuses with a Play-tab switch, and the rest Play-tab reminders; everything else is listed as a racial feature. Imports set the race too: from Hero Lab the race is applied with its bonuses and features, and fixed racial ability modifiers move from the base scores to the Race tab so totals stay the same (a human's, half-elf's or half-orc's +2 to one score stays in the base scores, since Hero Lab doesn't record which one). From the spreadsheet the race is recognized and its features and senses added, without changing numbers.
- **Feats, traits, class features and worn magic items:** each can carry bonuses that change your numbers: skills, saves, AC, natural armor, CMD, CMB, max HP, initiative, attack and damage (all, melee, ranged, or one named weapon), caster level and speed. Values can be formulas using `level`, `bab`, `cl` (caster level), ability modifiers, `ranks`, `class1`/`class2`/`class3` (levels in each class slot) or a class name such as `rogue` or `machine_smith` (your levels in that class), e.g. `max(3, level)` for Toughness, `max(1, floor(rogue/2))` for Trapfinding or `ranks >= 10 ? 6 : 3` for Skill Focus. The **?** beside each value explains the variables, and the result shows next to the field. **Add standard bonuses** fills them in for common feats (Toughness, Improved Initiative, Iron Will, Skill Focus, Weapon Focus, Dodge, the +2/+2 skill feats…) traits (Reactionary, Resilient…) and magic items (belts and headbands of ability scores, cloaks of resistance, rings of protection, amulets of natural armor, bracers of armor, skill items like Eyes of the Eagle). An item's enhancement bonus to an ability doesn't add on top of the same amount typed in the ability's Enhance column. Situational ones become reminders on the Play tab.
- **Situational bonuses:** a bonus can be marked situational with the ◐ button beside it. It then starts switched off and gets a switch on the Play tab, so its numbers count only while it applies. The sheet sets this up itself for bonuses it knows are situational: feats (Point-Blank Shot +1 ranged attack and damage, Mobility +4 dodge AC, Cleave and Lunge −2 AC, Two-Weapon Defense, the Improved maneuver feats' +2 CMB and CMD), traits (Courageous, Birthmark), class features (Bravery and Trap Sense by level, Favored Enemy, Favored Terrain, Inspire Courage by bard level, Bane, Challenge, Studied Target, Still Mind, Resist Nature) and racial traits (Hatred, Defensive Training, Hardy, Stability, Elven Immunities, Fearless, Illusion Resistance…). For races, feats, traits and class features it has no entry for, it reads the rules text: "+2 racial bonus on saving throws against poison" becomes a switchable +2 on saves, "+2 bonus on Perception and Stealth checks in forests" two switchable skill bonuses, and a bonus with no condition ("+2 dodge bonus to Armor Class") an ordinary one. Read bonuses keep the sentence they came from as their note, so you can check them.
- **Companions:** *Animal Companion* follows the Core Rulebook table by effective druid level (HD, BAB, saves, natural armor, Str/Dex bonus, tricks, feats, special abilities). *Eidolon* follows the APG summoner table (HD d10, full BAB, two good saves from the base form, armor bonus, Str/Dex bonus, evolution pool, max attacks), with an evolutions list tracked against the pool. *Familiar* uses half your HP, your BAB, the better of its own base saves (from its own Hit Dice, 1 for most familiars) or yours, your skill ranks, and natural armor/Int/abilities by your level. *Other* lets you set HD, hit die, BAB progression and good saves. Abilities can be "-" (no score, e.g. a construct's Con). Attacks support count, primary/secondary, Str multiplier, iteratives, Multiattack and Power Attack. Companions use the same bonus system as the character: buffs (with presets such as Bless, Haste, Mage Armor, Barkskin, Bull's Strength, Shield of Faith), feats, gear (which autofills its description, slot and usual bonuses from the SRD, like your worn items) and eidolon evolutions can carry typed bonuses, conditions apply to them, and they get their own Active Bonuses and Not-stacking lists. In companion formulas `level` is the companion's HD and class names are your class levels (e.g. `druid`). Each companion also has **Spells & Abilities** with the same setup as your spells (dice, touch attack, save, DC, buff); they use the companion's HD as caster level unless you set one, its own touch attack and modifiers, and buffs default to the companion itself. Unchained summoner eidolons use different numbers; model those with *Other*.
- **HP:** all six HP formulas, Con, favored-class HP, damage/temp/nonlethal tracking and negative levels.
- **Abilities:** age modifiers, enhancement vs. effect bonuses, inherent bonuses and penalties.
- **Effect table:** each row can also hold bonuses with their own type and target (a named skill or weapon too): click **+ bonuses** under the name. Spell buffs, Smite Evil and import adjustments use these. Bonuses of the same type don't stack, while penalties and Untyped, Dodge and Circumstance bonuses do. Deflection, Enhancement and Resistance are separate types. Effects reach AC, saves, abilities, attacks, damage, caster level, extra attacks, size, speed and skills. The free-text column applies to named skills and Initiative.
- **Common combat effects:** Power Attack, Combat Expertise, Deadly Aim, Heroism, Haste, Rapid Shot and Studied Target are ordinary rows of the Effects table (the spreadsheet's Combat Quick Toggles). The scaling ones are formulas you can see and edit: Power Attack is `-(floor(bab/4)+1)` to hit and `2*(floor(bab/4)+1)` damage, Studied Target `1 + floor(slayer/5)`, Haste's speed `min(30, speed)`. Delete the ones you don't use; **Add common effect** brings them back. Any effect cell can be a formula (the bonus variables plus `speed`, `fly`, `swim`, `burrow`, `climb`), with the result shown under it. Characters saved with the old toggle table are converted automatically.
- **Conditions:** the sheet's conditions table, plus Unchained wound thresholds.
- **Defenses:** AC, touch, flat-footed and CMD, with armor and shield tables, special materials, max Dex, armor check penalty, spell failure and encumbrance.
- **Gear and encumbrance:** an inventory with quantity, weight, value and a Carried box (uncheck things left on a mount or at home), coins (50 coins weigh 1 lb, which you can switch off), and weights for weapons, armor and shields (armor and shields fill in their standard weight; mithral halves it). Carrying capacity follows the Core Rulebook table from your Strength and size, with a Str adjustment for carrying (muleback cords), a capacity multiplier (ant haul) and a quadruped option. With encumbrance set to **Auto (from gear)**, the default for new and imported characters, a medium or heavy load limits max Dex, adds an armor check penalty and reduces speed, just like armor. The Play tab shows your load. Characters saved before this keep the encumbrance they had; choose Auto on the Combat tab or the inventory card to switch.
- **Attacks:** all attack types from Formula References (melee, ranged, off-hand, maneuvers, magic, flurry, natural, bombs, kineticist) with iterative attacks, plus INT and CHA to-hit versions with the usual damage choices (STR, STR×1.5, STR×½, the same ability, DEX or none). The Formula dropdown groups options by the ability used to hit.
- **Skills:** Standard, Background, Consolidated and Psionics skill systems; trained-only, armor check, size, Fly maneuverability, and climb/swim speed bonuses.
- **Spellcasting:** spells per day from the class tables plus ability bonus spells, spells known, DCs, caster level, concentration, slot tracking and a **Rest** button.
- **Spell setup (⚙ next to each spell):** damage, healing or temporary HP dice, a ray or missile count (each ray rolls its own touch attack, crit check and damage; a natural 20 is a threat that rolls its confirmation like a weapon, and the critical damage (dice rolled twice) is shown next to the normal damage for when it's confirmed; Scorching Ray fires 1 to 3 rays by caster level, Magic Missile 1 to 5 missiles) (count and bonus can be formulas using `cl`, e.g. `min(cl, 5)` d6), damage type, saving throw, duration, and an optional ranged or melee touch attack with crit threats. A spell can also be a **buff**: give it bonuses and a target (you or a companion); casting it creates or switches on an effect named after the spell, which you switch off on the Play or Effects tab when it ends. **Add standard bonuses** fills in common buffs (Bless, Divine Favor, Prayer, Shield of Faith, Haste, Heroism, Mage Armor, Barkskin, Bull's Strength…). With **Temporary HP** ticked, casting adds the roll to the target's temporary HP (the higher amount stays, since temporary HP doesn't stack); Aid, False Life and Heroes' Feast fill this in. Reminders from active spell effects, such as Aid's bonus on saves against fear, show in the Play tab's situational list. Casting uses a slot and posts the rolls to the log and Discord. **Fill in from SRD** on the Spells card sets up every spell and spell-like ability that hasn't been set up yet (handy for imported characters); imports from the spreadsheet or Hero Lab do this automatically. Nothing you've set is overwritten. **Spell-like abilities** have the same setup, plus a caster level (blank = yours; type `level` for racial abilities) and a save DC formula such as `10 + 2 + cha`. Using one counts down its uses.

## Differences from the spreadsheet

These are small fixes, chosen to follow the Core Rulebook where the sheet's formulas fell short:

- **Conditions:** Stunned also loses your Dex bonus to AC; Grappled also takes −2 on attacks (and so on CMB) and can't move; **Flat-Footed** (no Dex or dodge bonus to AC and CMD), **Helpless** (Dex 0) and **Unconscious** (helpless, can't move) are added. The encumbrance conditions (Light/Medium/Heavy Encumbrance, Overencumbered) now set your load, using whichever is heavier: the condition or the load from your gear or the Combat tab.
- **Movement:** over your heavy load you can move only 5 ft (Slow and Steady still ignores it), and you run at ×4 with a medium load or medium armor; only heavy armor or a heavy load drops running to ×3.
- The sheet's single "Deflect/Enhance/Resist" type is split into **Deflection**, **Enhancement** and **Resistance**, which stack with each other. An Enhancement bonus on AC (such as Magic Vestment) replaces the armor's own enhancement if it's higher. Imported and older saved characters are converted automatically: AC becomes Deflection, saves become Resistance, and anything else becomes Enhancement.

- Negative levels also apply to Fortitude saves. The sheet left Fort out.
- Wound thresholds also apply to Fortitude and skills, matching the Unchained rule text.
- The effect table's **CL** column adds to caster level. The sheet computed it but never used it.
- The ranged **1stA** column applies to the first ranged attack. The sheet ignored it.
- Spells known reads the correct column. The sheet was off by one.
- Rapid Bomb uses normal iterative attacks.
- Haste only adds speed to movement modes you have.
- Deafened's −4 Initiative applies.
- Heroism no longer adds +2 to Initiative (the spell covers attacks, saves and skill checks only), and Studied Target scales with slayer level and applies to ranged attacks. Saved and imported characters with the old defaults are updated.

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
| `js/herolab.js` | Hero Lab portfolio (`.por`) and XML importer |
| `js/dice.js` | Dice expressions, checks, crits |
| `js/discord.js` | Webhook posting |
| `js/srd.js` | Loads the rules data and looks up names for autofill |
| `js/app.js` | Interface, saving, rolling |
| `data/srd/*.json` | Rules data for autofill, generated from the Pathfinder Reference Document |
| `OGL.txt` | Open Game License for the rules data |
| `tools/extract.py` | Regenerates `js/data.js` from an Autosheet `.xlsx` |
| `tools/dump_cells.py`, `tools/verify.js` | Compares the web sheet's math with a real character's spreadsheet |
| `tools/build_srd.py` | Regenerates `data/srd/` from the PSRD-Data book databases |

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

To regenerate the rules data, download the `book-*.db` files from the `release` branch of [PSRD-Data](https://github.com/devonjones/PSRD-Data) into a folder, then:

```powershell
python tools/build_srd.py path\to\folder data/srd
```

## Possible next steps

- **Discord bot:** slash commands like `/roll stealth` that read the character. This needs a small always-on host. The character JSON is ready for it.
- **Shared party storage:** a GM can see everyone's sheets live. This needs a backend.

## Credits

Based on the Pathfinder Autosheet v6.2.1 by /u/darthmarth28. That sheet is free for non-commercial use and may not be rehosted as someone else's work, so keep this credit if you share the web version.

The rules data in `data/srd/` is Open Game Content from the Pathfinder Roleplaying Game Reference Document by Paizo, used under the Open Game License 1.0a (see `OGL.txt`), converted from Devon Jones's [PSRD-Data](https://github.com/devonjones/PSRD-Data). This project uses no Paizo trademarks or Product Identity and isn't published, endorsed or approved by Paizo.
