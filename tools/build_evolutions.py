"""Eidolon evolutions (APG, Ultimate Magic, Advanced Race Guide) -> data/srd/evolutions.json

    python tools/build_evolutions.py <folder with the PSRD book-*.db files> data/srd

Each entry: n name, cost (evolution points), s source, d rules text, and when the text says so:
  lvl  the summoner level needed to take it
  forms  the base forms that can take it
  req  evolutions it needs first
  b    bonuses per pick (the sheet's bonus rows; checked by hand against the text below)
  atk  the natural attack it adds: [name, count, primary?, Medium dice, Large dice, Huge dice]
"""
import html, json, os, re, sqlite3, sys

SRC, OUT = sys.argv[1], sys.argv[2]
BOOKS = [('apg', 'APG'), ('um', 'UM'), ('arg', 'ARG')]


def dec(b):
    if b is None:
        return ''
    if isinstance(b, str):
        return b
    try:
        return b.decode('utf-8')
    except UnicodeDecodeError:
        return b.decode('cp1252')


def text(h):
    h = re.sub(r'<br\s*/?>', ' ', dec(h))
    h = re.sub(r'</p>\s*<p[^>]*>', '\n', h)
    h = re.sub(r'<[^>]+>', '', h)
    t = re.sub(r'[ \t]+', ' ', html.unescape(h)).strip()
    # dashes the source lost (U+FFFD): a minus before a number, else an em dash
    t = re.sub('\ufffd(?=\\s?\\d)', '\u2212', t).replace('\ufffd', '\u2014')
    # the books' minus signs before numbers
    return re.sub('(?<=\\s)[\u2013\u2014-](?=\\d)', '\u2212', t)


U, R, S, M = 'Untyped (stacks)', 'Racial', 'Size', 'Morale'


def B(target, value, type_=U, text='', situational=False, skill=''):
    b = {'target': target, 'value': value, 'type': type_, 'text': text}
    if situational:
        b['situational'] = True
    if skill:
        b['skill'] = skill
    return b


def note(t):
    return [B('note', '', U, t)]


# Bonuses per pick. "pick" in a skill/ability means the name's (detail) chooses it: Skilled (Stealth), Ability Increase (Dex)
RULES = {
    'Improved Natural Armor': [B('nat', 2, U, '+2 natural armor per pick')],
    'Ability Increase': [B('pick-ability', 2, U, '+2 to the ability named in brackets, e.g. Ability Increase (Str)')],
    'Skilled': [B('skill', 8, R, '+8 racial bonus to the skill named in brackets', skill='pick')],
    'Tail': [B('skill', 2, R, 'Acrobatics checks to balance', situational=True, skill='Acrobatics')],
    'Grab': [B('cmb', 4, U, 'Grapple checks', situational=True)],
    'Pincers': [B('cmb', 2, U, 'Grapple with grab linked to pincers', situational=True)],
    'Large': [B('str', 8, S, 'Large'), B('con', 4, S, 'Large'), B('dex', -2, S, 'Large'), B('nat', 2, U, 'Large'),
              B('note', '', U, 'Set the companion\'s Size to Large (size changes AC, attacks, CMB/CMD, Fly and Stealth). Huge (6 more points): +16 Str, +8 Con, -4 Dex, +5 natural armor instead')],
    'Channel Resistance': [B('saves', 2, U, 'Saves against channel energy (+4 for 2 more points at 7th level)', situational=True)],
    'Undead Appearance': [B('saves', 2, U, 'Saves against disease, exhaustion, fatigue, paralysis, poison, sleep and stunning (+4 for 2 more points at 7th)', situational=True)],
    'Resistance': note('Resist 5 against one energy type (10 at summoner level 5, 15 at 10)'),
    'Immunity': note('Immunity to one energy type'),
    'Damage Reduction': note('DR 5 bypassed by one opposed alignment (DR 10 for 2 more points at 12th level)'),
    'Spell Resistance': note('Spell resistance 11 + summoner level (not against your spells)'),
    'Fast Healing': note('Fast healing 1 (+1 per 2 more points, max 5); not on another plane from you'),
    'Energy Attacks': note('+1d6 energy damage (acid, cold, electricity or fire) with all natural attacks'),
    'Magic Attacks': note('Natural attacks count as magic for DR (and as its alignment at summoner level 10)'),
    'Improved Damage': note('One natural attack\'s damage die goes up one step'),
    'Reach': note('+5 ft. reach with one attack'),
    'Pounce': note('Full attack after a charge'),
    'Limbs': note('Legs: +10 ft. base speed per pair. Arms: hands for weapons and more attack evolutions'),
    'Climb': note('Climb speed equal to base speed (+20 ft. per extra pick)'),
    'Swim': note('Swim speed equal to base speed (+20 ft. per extra pick)'),
    'Flight': note('Fly speed equal to base speed (good maneuverability Medium or smaller, average Large, poor Huge; +20 ft. per extra point)'),
    'Burrow': note('Burrow speed equal to half base speed'),
    'Scent': note('Scent 30 ft.'),
    'Blindsense': note('Blindsense 30 ft.'),
    'Blindsight': note('Blindsight 30 ft.'),
    'Tremorsense': note('Tremorsense 30 ft.'),
    'Lifesense': note('Notices and locates living creatures within 60 ft.'),
    'See in Darkness': note('Sees perfectly in any darkness'),
    'Low-Light Vision': note('Low-light vision'),
    'Gills': note('Breathes underwater'),
    'No Breath': note('Doesn\'t breathe; immune to inhaled effects'),
    'Weapon Training': note('Simple Weapon Proficiency (martial weapons for 2 more points)'),
    'Mount': note('Combat-trained mount (one size larger than its rider)'),
    'Trip': note('Free trip attempt on a bite hit'),
    'Push': note('Free combat maneuver to push 5 ft. on a hit with one attack type'),
    'Pull': note('Free combat maneuver to pull 5 ft. closer on a hit with one attack type'),
    'Constrict': note('Extra damage equal to the grab attack on a successful grapple'),
    'Rend': note('Two claw hits on one target: extra damage of one claw + 1-1/2 Str'),
    'Rake': note('2 rake attacks (1d4, primary) against a creature it grapples'),
    'Trample': note('Trample 1d6 (1d8 Large, 2d6 Huge) + 1-1/2 Str; Reflex half, DC 10 + 1/2 HD + Str'),
    'Poison': note('Poison: Fort DC 10 + 1/2 HD + Con, 1/round for 4 rounds, 1d4 Str (Con for 2 more points), cure 1 save'),
    'Frightful Presence': note('Frightful presence 30 ft.: Will DC 10 + 1/2 HD + Cha or shaken 3d6 rounds'),
    'Breath Weapon': note('Breath weapon 30-ft. cone or 60-ft. line, 1d6 per HD, Reflex half DC 10 + 1/2 HD + Con, 1/day (+1/day per extra point, max 3)'),
    'Web': note('Web 8/day, ranged touch 50 ft., entangles; escape DC 10 + 1/2 HD + Con'),
    'Swallow Whole': note('Swallow whole a creature grabbed with its bite'),
    'Shadow Blend (Su)': note('Concealment (20%) outside bright light; total concealment with shadow form'),
    'Shadow Form (Su)': note('Constant concealment (20%); melee attacks ghost touch but half damage to corporeal creatures'),
    'Incorporeal Form': note('Incorporeal 1 round per summoner level, 1/day'),
    'Unnatural Aura': note('Animals won\'t approach it willingly'),
    'Keen Scent': note('Scent 180 ft. underwater; detects blood up to a mile'),
    'Head': note('An extra head (room for more bite, gore or breath weapon evolutions)'),
    'Basic Magic': note('A 0-level spell 1/day as a spell-like ability (3/day for 2 more points at 4th); CL = HD, DC 10 + Cha'),
    'Minor Magic': note('A 1st-level spell 1/day (3/day for 2 more points at 7th); CL = HD - 2, DC 10 + 1/2 HD + Cha'),
    'Major Magic': note('A 2nd-level spell 1/day (3/day for 2 more points at 10th); CL = HD - 2, DC 10 + 1/2 HD + Cha'),
    'Ultimate Magic': note('A 3rd-level spell 1/day; CL = HD - 2, DC 10 + 1/2 HD + Cha'),
    'Dimension Door': note('Dimension door 1/day; CL = HD'),
}
# Attacks: [name, count, primary, Medium, Large, Huge]
ATTACKS = {
    'Bite': ['Bite', 1, True, '1d6', '1d8', '2d6'], 'Claws': ['Claw', 2, True, '1d4', '1d6', '1d8'],
    'Gore': ['Gore', 1, True, '1d6', '1d8', '2d6'], 'Hooves': ['Hoof', 2, False, '1d4', '1d6', '1d8'],
    'Pincers': ['Pincers', 2, False, '1d6', '1d8', '2d6'], 'Slam': ['Slam', 1, True, '1d8', '2d6', '2d8'],
    'Sting': ['Sting', 1, True, '1d4', '1d6', '1d8'], 'Tail Slap': ['Tail slap', 1, False, '1d6', '1d8', '2d6'],
    'Tentacle': ['Tentacle', 1, False, '1d4', '1d6', '1d8'], 'Wing Buffet': ['Wing buffet', 2, False, '1d4', '1d6', '1d8'],
}

out, seen = [], set()
for book, abbr in BOOKS:
    path = os.path.join(SRC, f'book-{book}.db')
    if not os.path.exists(path):
        print('missing', path)
        continue
    c = sqlite3.connect(path)
    c.text_factory = bytes
    for pid, pname in c.execute("select section_id, name from sections where lower(name) like '%-point evolutions'").fetchall():
        cost = int(re.match(rb'(\d)', pname).group(1))
        for sid, name, body, lft, rgt in c.execute('select section_id, name, body, lft, rgt from sections where parent_id=? order by lft', (pid,)).fetchall():
            name = dec(name).strip()
            if name.lower() in seen:
                continue
            seen.add(name.lower())
            sub = c.execute('select body from sections where lft>? and rgt<? order by lft', (lft, rgt)).fetchall()
            d = '\n'.join(t for t in [text(body)] + [text(b) for (b,) in sub] if t)
            e = {'n': name, 'cost': cost, 's': abbr, 'd': d}
            m = re.search(r'summoner must be at least (\d+)(?:st|nd|rd|th) level before selecting this evolution', d)
            if m:
                e['lvl'] = int(m.group(1))
            m = re.search(r'only available to eidolons of the (.+?) base forms?', d)
            if m:
                e['forms'] = [f.capitalize() for f in re.split(r'\s*(?:,|\band\b|\bor\b)\s*', m.group(1)) if f]
            req = re.findall(r'must (?:have|possess) the ([a-z ()]+?) evolutions?', d)
            if req:
                e['req'] = sorted(set(x.strip() for r in req for x in r.split(' and ') if x.strip()))
            if name in RULES:
                e['b'] = RULES[name]
            if name in ATTACKS:
                e['atk'] = ATTACKS[name]
            out.append(e)

missing = [e['n'] for e in out if 'b' not in e and 'atk' not in e]
print(len(out), 'evolutions;', 'no bonuses or attack:', missing)
unknown = set(RULES) - {e['n'] for e in out}
assert not unknown, unknown
with open(os.path.join(OUT, 'evolutions.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
