# ROUND 3 (read this first)
- Your input is `in3/qNN.jsonl` and your output `out/qNN.json` (wherever this brief says partNN/pNN, read qNN, and the
  input folder is `in3/`). Run `node check.js out/qNN.json in3/qNN.jsonl`.
- The texts are now **complete** (earlier rounds had texts cut off with "…"). Use the text; only fall back on your
  knowledge of the published rules when the text itself refers elsewhere, and say so in the rule's `note`.
- New optional field on a rule: `"dc": "10 + floor(cls / 2) + wis"` — the save DC the Use button shows when the
  ability has a DC but no dice (stunning fist, death attack, a hex). A rule may consist of only `dc` (+ `uses`).
- Save `out/qNN.json` after every batch of about 20 (a valid JSON array of the decisions so far).

# Pathfinder 1e class-feature audit — brief for one partition

You are auditing Pathfinder 1st Edition rules items for a character-sheet web app. For **every** item in your input file
you decide what the sheet needs so a player can use it at the table, and record it in a strict JSON format. Accuracy
matters more than speed: read each item's rules text, apply Pathfinder 1e rules as written, and do not invent numbers.

## Files

- Input: `in/partNN.jsonl` (one JSON object per line): `{ id, kind, owner, cls, name, level, text, hints }`
  - `kind`: `class` (class table feature), `archetype` (archetype ability), `choice` (a talent / rage power / hex /
    domain / bloodline / school / mystery / deed ...), `choice-power` (a power a path choice grants by level, e.g. a
    domain's granted power), `choice-pick` (a sub-pick such as a mystery revelation), `mythic`, `feat`, `race`.
  - `owner`: the class, archetype, "class / group", "Choice (Group)", mythic path, "Feat", or race it belongs to.
  - `cls`: the formula variable for the level of the class that grants it (e.g. `cleric`, `holy_vindicator`); `tier`
    for mythic; empty for feats/races.
  - `hints`: phrases a regex pulled out (per day, pools, +N bonus, dice, DC). They are only hints; the text decides.
- Your input is `in2/pNN.jsonl` (the brief says `partNN` in places; read it as `pNN`, input folder `in2/`).
- Output: `out/pNN.json` — a JSON array with **exactly one entry per input id, in input order**:
  `{ "id": "F00012", "rule": null }` when the sheet needs nothing, or `{ "id": "F00012", "rule": { ... } }`.
- Self-check before you finish: `node check.js out/pNN.json in2/pNN.jsonl` must print `OK`. Fix every error.

Work through the input in batches of about 20 items (print them with a small node script, read, decide). **After
every batch, rewrite `out/pNN.json` with all decisions so far** (a valid JSON array), so work survives an
interruption. If `out/pNN.json` already exists when you start, keep its decisions and continue from the next id.
Keep your batch-printing script small and put it in `out/` (named `pNN_*.js`). Do not edit anything outside `out/`.

## The rule object (all fields optional, but a non-null rule needs at least one of uses / roll / cost / bonuses)

```json
{
  "uses":    { "max": "3 + cha", "unit": "uses", "per": "day", "extra": [["Extra Channel", 2]], "note": "..." },
  "roll":    { "count": "ceil(cls / 2)", "die": 6, "bonus": "0", "dc": "10 + floor(cls / 2) + cha", "label": "positive energy" },
  "cost":    { "from": "Lay on Hands", "n": 2 },
  "bonuses": [ { "target": "will", "value": "max(1, floor((cls + 2) / 4))", "type": "Untyped (stacks)", "situational": true, "text": "Against fear" } ],
  "note":    "one short line for the person maintaining this, only if something is unusual"
}
```

### uses — a counter on the sheet
Use it when the ability can be used a limited number of times, rounds, minutes or points per day (or per week):
rage rounds, bardic performance rounds, channel energy, lay on hands, smite evil, ki pool, arcane pool, grit, panache,
judgment, wild shape, mercy-style daily powers, "3 + Wisdom modifier times per day" domain powers, bloodline powers, etc.
- `max`: formula for the maximum at the character's current levels (see Formulas). Include level scaling from the text
  (e.g. rage `4 + con + 2 * (cls - 1)`; smite evil `1 + floor((cls - 1) / 3)`; ki pool `floor(cls / 2) + wis`).
  If the ability is gained at a level above 1 and its uses count from that level, write the formula for levels at or
  above the gain level only (the sheet only shows the feature once the character has it).
- `unit`: `uses` | `rounds` | `minutes` | `hours` | `points`.
- `per`: `day` | `week`. (Abilities usable "once per round", "once per rage", "at will" or "constant" get **no** uses.)
- `extra`: feats that raise the maximum, `[["Extra Rage", 6]]` = +6 per copy of the feat. Only feats the text or the
  feat itself says (Extra Channel +2, Extra Lay On Hands +2, Extra Ki +2, Extra Rage +6, Extra Performance +6,
  Extra Arcane Pool +1, Extra Grit +2, Extra Panache +2, Extra Mercy no (it adds a mercy), Extra Hex no, Extra Rage Power no...).
  For a `feat` item that extends a pool, give a rule with only `"note": "extends <pool name> by N"` and put the
  `extra` entry on the pool's own class feature (if your partition does not contain the pool, still write the note).
- If the ability **spends uses of another ability** instead of having its own (hospitaler/paladin channel spends 2 uses
  of lay on hands; a vindicator's shield spends one use of channel energy; many mythic abilities spend mythic power),
  use `cost` instead of `uses`: `{ "from": "<exact name of the other ability>", "n": 2 }`. Mythic power costs are
  already handled by the app: for mythic items whose only resource is mythic power, return `null` unless they also
  have a bonus.

### roll — what the Use button rolls
Dice the ability rolls each time it's used: channel energy `ceil(cls/2)` d6, lay on hands `floor(cls/2)` d6,
alchemist bomb `ceil(cls/2)` d6 + int, sneak attack `ceil(cls/2)` d6 (no uses, roll only), a domain power's 1d6 + half
level... `count` and `bonus` are formulas, `die` a number (4, 6, 8, 10, 12), `dc` a formula when the text gives a save
DC (`10 + floor(cls / 2) + cha` style), `label` the damage/healing type in a word or two.

### bonuses — numbers the sheet adds (always on) or switches (situational)
Only for bonuses the sheet can apply to one of these targets:

`str dex con int wis cha` (ability scores), `skill` (one skill: give `"skill": "Perception"`), `skills` (all skills),
`saves fort ref will`, `ac nat cmd hp init`, `atk mAtk rAtk` (attack rolls: all / melee / ranged), `dmg mDmg rDmg`
(damage), `cmb`, `cl` (caster level), `speed`, `note` (reminder only, no number).

Skill names exactly: Acrobatics, Appraise, Bluff, Climb, Diplomacy, Disable Device, Disguise, Escape Artist, Fly,
Handle Animal, Heal, Intimidate, Kn. Arcana, Kn. Dungeoneering, Kn. Engineering, Kn. Geography, Kn. History,
Kn. Local, Kn. Nature, Kn. Nobility, Kn. Planes, Kn. Religion, Linguistics, Perception, Ride, Sense Motive,
Sleight of Hand, Spellcraft, Stealth, Survival, Swim, Use Magic Device (and Craft:, Perform:, Prof: with a detail are
not supported as targets — use `note` for those).

`type`: one of `Alchemical, Armor, Circumstance (stacks), Competence, Deflection, Dodge (stacks), Enhancement, Insight,
Luck, Morale, Precision Damage, Racial, Resistance, Sacred / Profane, Size, Trait, Untyped (stacks)` — the bonus type
the rules name (a "sacred bonus" is `Sacred / Profane`; "dodge bonus" `Dodge (stacks)`; no type named = `Untyped (stacks)`).

`situational: true` when the bonus only applies sometimes and the player switches it on at the table: against a
creature type, against fear/charm/poison, while raging, while flanking, during a performance, after activating the
ability, while unarmored, in a terrain, for a number of rounds... `situational: false` only when it always applies to
the character once they have the feature (e.g. a flat +2 on Perception, +1 dodge to AC at all times).
`text`: the condition in a few words ("Against fear", "While raging", "Against your favored enemy").

**Do not add bonuses** for: base attack, base saves, hit dice, spells per day, spell DCs, class skills, proficiencies,
bonus feats, things that change damage dice or the number of attacks, immunities (use a `note` bonus only if it is the
item's main effect), damage reduction or energy resistance (use a `note`), or bonuses whose amount depends on a
choice the text leaves open (use a `note`). Do not duplicate these, which the sheet already handles (you may still add
`uses`/`roll` to them): divine grace, unholy resilience, nature sense, fast movement, bravery, crafter, trapfinding,
trap sense, danger sense, evasion, improved evasion, uncanny dodge, improved uncanny dodge, sneak attack (bonus only;
add its roll), track, wild empathy, favored enemy, favored terrain, armor training, weapon training, channel energy
(bonus only), still mind, divine health, aura of courage, aura of resolve, resist nature, woodland stride, poison
resistance, stalwart, mettle, inspire courage, bane (inquisitor), challenge, studied target, bardic knowledge.

### When to return null
Text-only abilities with nothing to count, roll or add (proficiencies, "you can cast X", "you can choose", class
skills, bonus feats, movement tricks, most at-will abilities, abilities that only modify other abilities without a
number of their own), and anything whose numbers you cannot determine from the text. When in doubt between a vague
rule and `null`, choose `null` — a wrong number is worse than none.

## Formulas

JavaScript-style arithmetic with: `+ - * / ( )`, comparisons and `? :`, and the functions `max min floor ceil abs`.
Variables (all are numbers for the current character):
- `cls` — level in the class that grants the item (always prefer this; for archetypes and choices it is the base
  class; for mythic items use `tier`).
- `level` (total character level), `bab`, `cl` (caster level), `tier` (mythic tier).
- `str dex con int wis cha` — ability **modifiers**.
- Class levels by name (rarely needed): `barbarian`, `cleric`, `monk_unchained`, `holy_vindicator`, … (lowercase,
  non-letters become `_`).
Use `max(1, …)` where the text says "minimum 1". Division is not rounded unless you round it: use `floor(...)`.

## Examples (Pathfinder 1e Core Rulebook)

- Barbarian **Rage** (class): `{"uses":{"max":"4 + con + 2 * (cls - 1)","unit":"rounds","per":"day","extra":[["Extra Rage",6]]},"bonuses":[{"target":"str","value":"cls >= 20 ? 8 : cls >= 11 ? 6 : 4","type":"Morale","situational":true,"text":"While raging"},{"target":"con","value":"cls >= 20 ? 8 : cls >= 11 ? 6 : 4","type":"Morale","situational":true,"text":"While raging"},{"target":"will","value":"cls >= 20 ? 4 : cls >= 11 ? 3 : 2","type":"Morale","situational":true,"text":"While raging"},{"target":"ac","value":-2,"type":"Untyped (stacks)","situational":true,"text":"While raging"}]}`
- Cleric **Channel Energy**: `{"uses":{"max":"3 + cha","unit":"uses","per":"day","extra":[["Extra Channel",2]]},"roll":{"count":"ceil(cls / 2)","die":6,"dc":"10 + floor(cls / 2) + cha","label":"positive or negative energy"}}`
- Paladin **Lay on Hands**: `{"uses":{"max":"floor(cls / 2) + cha","unit":"uses","per":"day","extra":[["Extra Lay On Hands",2]]},"roll":{"count":"floor(cls / 2)","die":6,"label":"healing"}}`
- Paladin **Smite Evil**: `{"uses":{"max":"1 + floor((cls - 1) / 3)","unit":"uses","per":"day"},"bonuses":[{"target":"atk","value":"max(0, cha)","type":"Untyped (stacks)","situational":true,"text":"Against the smitten evil target"},{"target":"dmg","value":"cls","type":"Untyped (stacks)","situational":true,"text":"Against the smitten evil target"},{"target":"ac","value":"max(0, cha)","type":"Deflection","situational":true,"text":"Against the smitten target's attacks"}]}`
- Monk **Ki Pool**: `{"uses":{"max":"floor(cls / 2) + wis","unit":"points","per":"day","extra":[["Extra Ki",2]]}}`
- Fire domain **Fire Bolt** (choice-power): `{"uses":{"max":"3 + wis","unit":"uses","per":"day"},"roll":{"count":"1","die":6,"bonus":"floor(cls / 2)","label":"fire"}}`
- Rogue **Sneak Attack**: `{"roll":{"count":"ceil(cls / 2)","die":6,"label":"precision"}}`
- Barbarian **Uncanny Dodge**: `null` (already handled; nothing to count or roll).
- A rage power "+1 dodge bonus to AC while raging": `{"bonuses":[{"target":"ac","value":1,"type":"Dodge (stacks)","situational":true,"text":"While raging"}]}`

## Your final message
Report: how many items, how many rules, how many null, and up to 10 items you were unsure about (id, name, why).
