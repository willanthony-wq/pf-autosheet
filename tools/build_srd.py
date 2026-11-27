"""Build compact SRD data files (data/srd/*.json) from PSRD-Data SQLite books.

PSRD-Data (https://github.com/devonjones/PSRD-Data, release branch) converts Paizo's Pathfinder RPG
Reference Document, which is Open Game Content under the OGL 1.0a (see OGL.txt).

Usage:
    python tools/build_srd.py <folder with book-*.db files> data/srd

Books read: cr, apg, um, uc, arg, acg, ucampaign, ue, then the Bestiaries (b1-b4), Technology Guide, Mythic Adventures,
Monster Codex, NPC Codex and GameMastery Guide (earlier books win when a name repeats).
Creatures come from Bestiary 1-4 (monsters.json); animal companion starting statistics from every book (companions.json).
"""
import html, json, os, re, sqlite3, sys

SRC, OUT = sys.argv[1], sys.argv[2]
BOOKS = [('cr', 'CRB'), ('apg', 'APG'), ('um', 'UM'), ('uc', 'UC'), ('arg', 'ARG'), ('acg', 'ACG'), ('ucampaign', 'UCa'), ('ue', 'UE'),
         ('b1', 'B1'), ('b2', 'B2'), ('b3', 'B3'), ('b4', 'B4'), ('tech', 'TG'), ('ma', 'MA'), ('mc', 'MC'), ('npc', 'NPC'), ('gmg', 'GMG')]
BESTIARIES = ('B1', 'B2', 'B3', 'B4')
# Body slot from the section an item sits in, when the item's own slot field is empty (Ultimate Equipment files
# wondrous items under "Feet Slot Wondrous Items" and so on)
SLOT_SECTIONS = [(r'\bbelts?\b', 'belt'), (r'\bbody\b', 'body'), (r'\bchest\b', 'chest'), (r'\beyes?\b', 'eyes'), (r'\bfeet\b', 'feet'),
                 (r'\bhands?\b', 'hands'), (r'\bheadbands?\b', 'headband'), (r'\bhead\b', 'head'), (r'\bneck\b', 'neck'),
                 (r'\bshoulders?\b', 'shoulders'), (r'\bwrists?\b', 'wrists'), (r'^rings$|\brings\b', 'ring'), (r'slotless', 'none'),
                 (r'^specific (magic )?armors?$|^specific armor', 'armor'), (r'^specific (magic )?shields?$', 'shield')]
os.makedirs(OUT, exist_ok=True)


def text(h, limit=None):
    """HTML -> plain text."""
    if not h:
        return ''
    t = re.sub(r'<br\s*/?>|</p>|</li>|</tr>', '\n', h)
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t).replace('\xa0', ' ')
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r'\n\s*\n+', '\n', t).strip()
    if limit and len(t) > limit:
        t = t[:limit].rsplit(' ', 1)[0] + '…'
    return t


def num_weight(w):
    t = text(w).replace('lbs.', '').replace('lb.', '').strip()
    t = re.sub(r'[¹²³⁴⁵\d]+$', lambda m: m.group(0) if re.fullmatch(r'[\d./ ]+', m.group(0)) else '', t).strip()
    m = re.match(r'^(\d+)\s*/\s*(\d+)', t)
    if m:
        return round(int(m.group(1)) / int(m.group(2)), 3)
    m = re.match(r'^([\d,]+(?:\.\d+)?)', t)
    return float(m.group(1).replace(',', '')) if m else 0


def num_cost(c):
    t = text(c).lower().replace(',', '')
    m = re.search(r'([\d.]+)\s*(pp|gp|sp|cp)', t)
    if not m:
        return None
    v = float(m.group(1))
    return round(v * {'pp': 10, 'gp': 1, 'sp': 0.1, 'cp': 0.01}[m.group(2)], 2)


def prices(p):
    """'4,000 gp (+2), 16,000 gp (+4)' -> [[4000, '+2'], [16000, '+4']]; '2,000 gp' -> 2000."""
    t = text(p)
    parts = re.findall(r'([\d,]+(?:\.\d+)?)\s*gp(?:\s*\(([^)]+)\))?', t)
    if not parts:
        return None
    if len(parts) == 1 and not parts[0][1]:
        return float(parts[0][0].replace(',', ''))
    return [[float(a.replace(',', '')), b.strip()] for a, b in parts]


def dash(v):
    v = (v or '').strip()
    return '' if v in ('—', '-', '–') else v


def clean(n):
    return re.sub(r'\s+', ' ', html.unescape(n or '')).strip()


feats, traits, spells, items, gear, weapons, armor, classes, archetypes, choices, races = {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}
monsters, companions = {}, {}
mythic = {'base': [], 'paths': [], 'universal': []}
# Base mythic abilities and the tier each is gained (Mythic Adventures, Table: Base Mythic Abilities)
MYTHIC_BASE_TIER = {'hard to kill': 1, 'mythic power': 1, 'surge': 1, 'amazing initiative': 2, 'recuperation': 3, 'mythic saving throws': 5,
                    'force of will': 6, 'unstoppable': 8, 'immortal': 9, 'legendary hero': 10}

SKILLS = ['Acrobatics', 'Appraise', 'Bluff', 'Climb', 'Diplomacy', 'Disable Device', 'Disguise', 'Escape Artist', 'Fly', 'Handle Animal', 'Heal', 'Intimidate',
          'Linguistics', 'Perception', 'Ride', 'Sense Motive', 'Sleight of Hand', 'Spellcraft', 'Stealth', 'Survival', 'Swim', 'Use Magic Device']
ABIL = {'strength': 'str', 'dexterity': 'dex', 'constitution': 'con', 'intelligence': 'int', 'wisdom': 'wis', 'charisma': 'cha'}


def race_singular(n):
    n = clean(n)
    if n.endswith('men'):
        return n[:-3] + 'man'
    if n.lower() in ('dwarves', 'elves', 'half-elves'):
        return n[:-3] + 'f'
    if n.endswith('s') and n.lower() not in ('catfolk', 'ratfolk', 'merfolk', 'svirfneblin', 'kitsune', 'strix', 'nagaji', 'drow', 'duergar'):
        return n[:-1]
    return n


def skill_names(lst):
    out = []
    for part in re.split(r',\s*(?:and\s+)?|\s+and\s+', lst):
        part = part.strip()
        k = re.match(r'^Knowledge \((\w+)\)$', part)
        if k:
            out.append('Kn. ' + k.group(1).capitalize())
        elif part in SKILLS:
            out.append(part)
        else:
            return None   # Craft (alchemy), a skill of their choice...: not a plain bonus
    return out

# Class choices: (heading, kind, label). 'path' = pick one (or two) with powers by level; 'talent' = pick several; 'auto' = gained by level.
CHOICE_GROUPS = [
    (r'^(cleric )?domains$', 'path', 'Domain'), (r'^subdomains$', 'path', 'Subdomain'), (r'^inquisitions$', 'path', 'Inquisition'),
    (r'^(sorcerer |bloodrager )?bloodlines$', 'path', 'Bloodline'), (r'^arcane schools$', 'path', 'Arcane school'),
    (r'^mysteries$', 'path', 'Mystery'), (r"^oracle'?s curse$", 'path', 'Curse'), (r'^(cavalier )?orders$', 'path', 'Order'),
    (r'^spirits$', 'path', 'Spirit'), (r'^blessings$', 'path', 'Blessing'),
    (r'^rage powers$', 'talent', 'Rage power'), (r'^rogue talents$', 'talent', 'Rogue talent'), (r'^advanced talents$', 'talent', 'Advanced talent'),
    (r'^ninja tricks$', 'talent', 'Ninja trick'), (r'^master tricks$', 'talent', 'Master trick'), (r'^magus arcana$', 'talent', 'Magus arcana'),
    (r'^discoveries$', 'talent', 'Discovery'), (r'^hex(es)?$', 'talent', 'Hex'), (r'^major hex(es)?$', 'talent', 'Major hex'), (r'^grand hex(es)?$', 'talent', 'Grand hex'), (r'^patron spells$', 'path', 'Patron'),
    (r'^arcanist exploits$', 'talent', 'Exploit'), (r'^greater exploits$', 'talent', 'Greater exploit'),
    (r'^slayer talents$', 'talent', 'Slayer talent'), (r'^advanced slayer talents$', 'talent', 'Advanced slayer talent'),
    (r'^deeds$', 'auto', 'Deed'),
]
SUBPICK = re.compile(r'^(revelations|hexes|exploits)$', re.I)
CLASS_NAMES = {'alchemist', 'antipaladin', 'arcanist', 'barbarian', 'bard', 'bloodrager', 'brawler', 'cavalier', 'cleric', 'druid', 'fighter', 'gunslinger',
               'hunter', 'inquisitor', 'investigator', 'magus', 'monk', 'ninja', 'oracle', 'paladin', 'ranger', 'rogue', 'samurai', 'shaman', 'skald', 'slayer',
               'sorcerer', 'summoner', 'swashbuckler', 'warpriest', 'witch', 'wizard'}
LEVEL_RE = re.compile(r'(?:\bat|reaches|starting at|beginning at|upon reaching)\s+(\d+)(?:st|nd|rd|th) level', re.I)


def choice_group(name):
    for rx, kind, label in CHOICE_GROUPS:
        if re.match(rx, (name or '').strip(), re.I):
            return kind, label
    return None


def keep(store, name, val):
    k = name.lower()
    if k and k not in store:
        store[k] = val


for book, abbr in BOOKS:
    path = os.path.join(SRC, f'book-{book}.db')
    if not os.path.exists(path):
        print('missing', path)
        continue
    c = sqlite3.connect(path)
    c.row_factory = sqlite3.Row
    kids = lambda sid: c.execute('select * from sections where parent_id=? order by lft', (sid,)).fetchall()

    # ---- feats
    for r in c.execute("select * from sections where type='feat'"):
        name = clean(r['name'])
        types = [x[0] for x in c.execute('select feat_type from feat_types where section_id=?', (r['section_id'],))]
        pre = ben = ''
        for k in kids(r['section_id']):
            if (k['name'] or '').startswith('Prerequisite'):
                pre = text(k['body'] or k['description'], 300)
            elif (k['name'] or '').startswith('Benefit'):
                ben = text(k['body'] or k['description'], 700)
        keep(feats, name, {'n': name, 't': ', '.join(types), 's': abbr, 'd': text(r['description'], 300), 'p': pre, 'b': ben})

    # ---- traits
    for r in c.execute("select * from sections where type='trait'"):
        name = clean(r['name'])
        body = text(r['body'] or r['description'], 450)
        keep(traits, name, {'n': name, 't': (r['subtype'] or '').replace('_', ' '), 's': abbr, 'd': body})

    # ---- spells
    for r in c.execute("select s.*, d.school, d.subschool_text, d.descriptor_text, d.level_text, d.casting_time, d.range, d.duration, d.saving_throw, d.spell_resistance "
                       "from sections s join spell_details d on d.section_id=s.section_id where s.type='spell'"):
        name = clean(r['name'])
        full = text(r['body'])
        sp = {'n': name, 's': abbr, 'sc': r['school'] or '', 'lv': r['level_text'] or '', 'ct': r['casting_time'] or '', 'r': r['range'] or '',
              'du': r['duration'] or '', 'sv': r['saving_throw'] or '', 'sr': r['spell_resistance'] or '', 'd': text(r['description'], 200)}
        low = full.lower()
        reflex = (r['saving_throw'] or '').lower().startswith('reflex')  # area spells mention touch attacks only for misses
        if 'ranged touch attack' in low and not reflex:
            sp['atk'] = 'rtouch'
        elif 'melee touch attack' in low and not reflex:
            sp['atk'] = 'mtouch'
        # damage / healing dice
        m = re.search(r'(\d+)d(\d+)\s+points? of ([a-z ]*?)damage per (two |three )?(?:caster )?levels?\s*\(maximum (\d+)d\d+\)', low)
        if m:
            per = {'two ': 2, 'three ': 3}.get(m.group(4) or '', 1)
            cnt = int(m.group(1))
            mx = int(m.group(5))
            base = 'cl' if per == 1 else f'floor(cl/{per})'
            sp['dmg'] = {'c': f'min({base}, {mx})' if cnt == 1 else f'min({cnt}*{base}, {mx})', 'd': int(m.group(2)), 't': m.group(3).strip()}
        else:
            m = re.search(r'(\d+)d(\d+)\s+points? of damage \+ ?1 point per caster level \(maximum \+(\d+)\)', low)
            if m:
                sp['dmg'] = {'c': m.group(1), 'd': int(m.group(2)), 'b': f'min(cl, {m.group(3)})', 't': ''}
            else:
                m = re.search(r'deals? (\d+)d(\d+)(?: points of)? ([a-z]+ )?damage', low)
                if m:
                    sp['dmg'] = {'c': m.group(1), 'd': int(m.group(2)), 't': (m.group(3) or '').strip()}
        if name.lower().startswith(('cure ', 'mass cure')) and 'dmg' in sp:
            sp['heal'] = True
        keep(spells, name, sp)

    # ---- magic items (and UE gear items with details)
    for r in c.execute("select s.*, d.slot, d.price, d.weight, d.cl, d.aura from sections s join item_details d on d.section_id=s.section_id where s.type='item'"):
        name = clean(r['name'])
        desc = r['description'] or r['body']
        if not desc:
            k = c.execute("select body from sections where parent_id=? and name='Description'", (r['section_id'],)).fetchone()
            desc = k[0] if k else ''
        slot = (r['slot'] or '').strip()
        if not slot:
            pid = r['parent_id']
            while pid and not slot:
                a = c.execute('select parent_id, name from sections where section_id=?', (pid,)).fetchone()
                if not a:
                    break
                an = clean(a[1]).lower()
                for rx, sl in SLOT_SECTIONS:
                    if re.search(rx, an):
                        slot = sl
                        break
                pid = a[0]
        # One spelling per slot ("None", "none (see below)", "wrist", stray "<")
        slot = slot.lower().replace('<', '').strip()
        slot = 'none' if slot.startswith('none') else 'wrists' if slot == 'wrist' else slot
        keep(items, name, {'n': name, 's': abbr, 'slot': slot, 'p': prices(r['price']), 'w': num_weight(r['weight']),
                           'cl': text(r['cl']), 'd': text(desc, 320)})

    # ---- equipment tables (weapons, armor, goods)
    for r in c.execute("select * from sections where type='table'"):
        cap = clean(r['name'])
        body = r['body'] or ''
        if 'Cost' not in body or 'Weight' not in body:
            continue
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', body, re.S)
        heads = []
        group = ''
        for row in rows:
            ths = re.findall(r'<th([^>]*)>(.*?)</th>', row, re.S)
            if ths and not re.search(r'<td', row):
                h = []
                for attrs, x in ths:
                    nm = re.sub(r'\d+$', '', text(x)).strip()
                    span = re.search(r'colspan="(\d+)"', attrs)
                    h += [nm] if not span else [f'{nm} {i}' for i in range(int(span.group(1)))]
                if 'Cost' in h:
                    heads = h
                    group = h[0]
                continue
            tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)
            if len(tds) == 1 or (tds and 'colspan' in row and len(tds) < 3):
                group = text(tds[0])
                continue
            if not heads or len(tds) < 3:
                continue
            cell = dict(zip(heads, [text(x) for x in tds]))
            name = re.sub(r'[¹²³⁴⁵]|\s*\d$', '', cell.get(heads[0], '')).strip()
            if not name or name.lower() in ('—', '-'):
                continue
            weight_key = next((h for h in heads if h.startswith('Weight')), None)
            w = num_weight(cell.get(weight_key, '')) if weight_key else 0
            cost = num_cost(cell.get('Cost', ''))
            if 'Dmg (M)' in heads and 'Critical' in heads:
                crit = cell.get('Critical', '×2').replace('–', '-')
                cm = re.match(r'^(\d+-20)?/?\s*[×x](\d)', crit)
                g = (group + ' ' + heads[0]).lower()
                kind = 'ranged' if 'ranged' in g else 'ammo' if 'ammunition' in g else 'two' if 'two-handed' in g else 'light' if 'light' in g or 'unarmed' in g else 'one'
                keep(weapons, name, {'n': name, 's': abbr, 'cost': cost, 'ds': cell.get('Dmg (S)', ''), 'dm': cell.get('Dmg (M)', ''),
                                     'cr': (cm.group(1) if cm and cm.group(1) else '20'), 'x': 'x' + (cm.group(2) if cm else '2'),
                                     'rg': re.sub(r'[^\d]', '', cell.get('Range', '')), 'w': w, 'ty': dash(cell.get('Type', '')),
                                     'k': kind, 'sp': dash(cell.get('Special', ''))})
            elif any(h.startswith('Armor/Shield Bonus') or h == 'Armor Bonus' for h in heads):
                g = group.lower()
                bonus_key = next(h for h in heads if h.startswith('Armor'))
                ival = lambda k: (lambda m: int(m.group(0)) if m else None)(re.search(r'[-+]?\d+', dash(cell.get(next((h for h in heads if h.startswith(k)), ''), '')).replace('–', '-').replace('−', '-')))
                keep(armor, name, {'n': name, 's': abbr, 'cost': cost, 'w': w, 'ac': ival('Armor/Shield') if ival('Armor/Shield') is not None else ival('Armor Bonus'), 'md': ival('Maximum Dex'), 'acp': ival('Armor Check'), 'asf': ival('Arcane'),
                                   'k': 'shield' if 'shield' in g else 'heavy' if 'heavy' in g else 'medium' if 'medium' in g else 'light'})
            elif 'Item' in heads[0] or cap.endswith(('Goods and Services', 'Adventuring Gear', 'Tools and Skill Kits', 'Clothing', 'Food and Drink',
                                                         'Alchemical Remedies', 'Alchemical Tools', 'Alchemical Weapons', 'Entertainment and Trade Goods')):
                keep(gear, name, {'n': name, 's': abbr, 'cost': cost, 'w': w})

    # ---- archetypes: abilities with the level gained and the class features they replace or modify
    for a in c.execute("select * from sections where type='class_archetype'"):
        cls = (a['subtype'] or '').replace('_', ' ').strip().lower()
        name = clean(a['name'])
        if not cls or not name:
            continue
        key = f'{cls}|{name.lower()}'
        if key in archetypes:
            continue
        abilities = []
        if re.match(r'^(class skills|class features|ex-)', name, re.I):   # class sections filed as archetypes (e.g. the APG antipaladin)
            continue
        for k in kids(a['section_id']):
            if k['type'] not in ('ability', 'section'):
                continue
            t = text(k['body'] or k['description'])
            # Plain sections are abilities too, except lists of suggested options ("The following rage powers complement...")
            if k['type'] == 'section' and (re.match(r'^the following', t, re.I) or not t):
                continue
            lv = re.search(r'(?:\bat|reaches|starting at|beginning at|upon reaching)\s+(\d+)(?:st|nd|rd|th) level', t, re.I)
            def names(m):
                out = []
                for part in re.split(r',\s*|\s+and\s+|\s+or\s+', m):
                    part = re.sub(r"^(the\s+)?(standard\s+)?([\w\s]+?'s?\s+)?", '', part.strip(), flags=re.I) if re.match(r"^(the\s+)?(standard\s+)?\w+'s?\s", part.strip(), re.I) else part.strip()
                    part = re.sub(r'^(the|a|an)\s+', '', part, flags=re.I)
                    part = re.sub(r'\s+(class features?|abilit(y|ies)|bonus(es)?|feature)$', '', part, flags=re.I).strip(' .')
                    if part and len(part) < 60:
                        out.append(part)
                return out
            rep_m = re.findall(r'(?:this|which|it)\s+(?:ability\s+|power\s+)?replaces?\s+([^.;]+)', t, re.I)
            mod_m = re.findall(r'(?:this|which|it)\s+(?:ability\s+)?(?:modifies|alters|changes)\s+([^.;]+)', t, re.I)
            abilities.append({'n': re.sub(r'\s*\((Ex|Su|Sp)\)$', '', clean(k['name'])), 'l': int(lv.group(1)) if lv else 1, 'd': text(k['body'] or k['description'], 600),
                              'r': [x for m in rep_m for x in names(m)], 'm': [x for m in mod_m for x in names(m)]})
        if abilities:
            archetypes[key] = {'n': name, 'c': cls, 's': abbr, 'd': text(a['body'] or a['description'], 300), 'a': abilities}

    # ---- class choices (domains, bloodlines, schools, mysteries, orders..., rage powers, talents, hexes...)
    by_id = {}
    def node(sid):
        if sid not in by_id:
            by_id[sid] = c.execute('select section_id, parent_id, type, subtype, name, body, description from sections where section_id=?', (sid,)).fetchone()
        return by_id[sid]
    def owner(sec):
        """The base class a group belongs to (None inside an archetype, or nested in another choice group)."""
        pid = sec['parent_id']
        while pid:
            r = node(pid)
            if not r:
                return None
            if r['type'] == 'class_archetype' or choice_group(r['name']):
                return None
            if r['type'] == 'class' or clean(r['name']).lower() in CLASS_NAMES:
                return clean(r['name']).lower()
            pid = r['parent_id']
        return None
    def lvl_of(t, default=1):
        first = re.split(r'(?<=[.!?])\s+', (t or '').strip(), maxsplit=1)[0]   # the level is stated up front ("At 6th level, ...")
        m = LEVEL_RE.search(first)
        return int(m.group(1)) if m else default
    def nm(x):
        return re.sub(r'\s*\((Ex|Su|Sp)\)$', '', re.sub(r'\*+', '', clean(x))).strip()
    def spells_from(t):
        t = t.replace('\u2013', '\u2014')
        dom = re.findall(r'\b(\d+)(?:st|nd|rd|th)\s*\u2014\s*([^,]+?)(?=,\s*\d+(?:st|nd|rd|th)|$)', t)
        if dom:
            return 'spell', [[int(l), x.strip().rstrip('.')] for l, x in dom]
        blo = re.findall(r'([^,]+?)\s*\((\d+)(?:st|nd|rd|th)\)', t)
        lv = [int(l) for _, l in blo]
        # Spirit magic lists spell levels 1-9; bloodlines and mysteries list the class level gained (3, 5, 7... or 2, 4, 6...)
        kind = 'spell' if lv and lv == list(range(1, len(lv) + 1)) else 'class'
        return kind, [[int(l), x.strip()] for x, l in blo]
    for g in c.execute("select * from sections where type in ('section', 'ability')"):
        grp = choice_group(g['name'])
        if not grp:
            continue
        cls = owner(g)
        if not cls:
            continue
        kind, label = grp
        for o in kids(g['section_id']):
            if o['type'] not in ('section', 'ability') or not o['name'] or o['name'].startswith('Table'):
                continue
            body = text(o['body'] or o['description'])
            if kind != 'path':
                if re.match(r'^the following', body, re.I) or not body:
                    continue
                key = f'{cls}|{label}|{nm(o["name"]).lower()}'
                if key not in choices:
                    choices[key] = {'n': nm(o['name']), 'c': cls, 'g': label, 'k': kind, 's': abbr, 'd': text(o['body'] or o['description'], 700), 'l': lvl_of(body, 1)}
                continue
            opt = {'n': nm(o['name']), 'c': cls, 'g': label, 'k': kind, 's': abbr, 'd': text(o['body'] or o['description'], 400), 'p': [], 'picks': []}
            for k in kids(o['section_id']):
                kt, kn = text(k['body'] or k['description']), clean(k['name'] or '')
                sub = kids(k['section_id'])
                if k['type'] == 'ability':
                    opt['p'].append({'n': nm(kn), 'l': lvl_of(kt), 'd': text(k['body'] or k['description'], 600)})
                elif re.search(r'spells', kn, re.I):
                    opt['st'], opt['sp'] = spells_from(kt)
                elif SUBPICK.match(kn):
                    opt['pg'] = kn.rstrip('s') if not kn.lower().endswith('hexes') else 'Hex'
                    opt['picks'] += [{'n': nm(x['name']), 'd': text(x['body'] or x['description'], 600), 'l': lvl_of(text(x['body'] or x['description']), 1)} for x in sub if x['type'] in ('ability', 'section')]
                elif re.match(r'^associated domain', kn, re.I):
                    opt['assoc'] = kt.strip(' .')
                else:
                    abil = [x for x in sub if x['type'] == 'ability']
                    rp = re.search(r'replaces the (.+?) power', kt, re.I)
                    if abil:
                        for x in abil:
                            pw = {'n': nm(x['name']), 'l': lvl_of(text(x['body'] or x['description'])), 'd': text(x['body'] or x['description'], 600)}
                            if rp:
                                pw['r'] = rp.group(1).strip()
                            opt['p'].append(pw)
                    if kt and not re.search(r'powers$|^order abilities$|^replacement power$|^granted powers$', kn, re.I):
                        opt['p'].append({'n': kn, 'l': 20 if re.match(r'^final revelation', kn, re.I) else lvl_of(kt), 'd': text(k['body'] or k['description'], 600)})
            # Witch patrons list their spells in their own text by witch level: "2nd—jump, 4th—cat's grace..."
            if label == 'Patron' and not opt.get('sp'):
                _, sp = spells_from(body)
                if sp:
                    opt['st'], opt['sp'] = 'class', sp
                    opt['p'].append({'n': f"{opt['n']} patron spells", 'l': 1, 'd': text(o['body'] or o['description'], 600)})
            if not opt['p'] and not opt['picks'] and body:
                opt['p'].append({'n': opt['n'], 'l': 1, 'd': text(o['body'] or o['description'], 600)})
            if not opt['picks']:
                del opt['picks']
            key = f'{cls}|{label}|{opt["n"].lower()}'
            if key not in choices:
                choices[key] = opt

    # ---- creatures (Bestiaries): the numbers a companion, familiar, mount or summoned creature needs
    if abbr in BESTIARIES:
        for r in c.execute("select s.name, s.description, d.* from sections s join creature_details d on d.section_id=s.section_id where s.type='creature'"):
            name = clean(r['name'])
            if not name or name.lower() in monsters:
                continue
            ac = text(r['ac'])
            nat = re.search(r'([+-]\d+) natural', ac)
            hd = re.search(r'\((\d+)d(\d+)', r['hp'] or '')
            g = lambda k: text(r[k]) if r[k] else ''
            m = {'n': name, 's': abbr, 'cr': g('cr'), 'size': g('size'), 'type': g('creature_type'), 'sub': g('creature_subtype'),
                 'ac': ac, 'nat': int(nat.group(1)) if nat else 0, 'hp': g('hp'), 'hd': int(hd.group(1)) if hd else None, 'hdie': int(hd.group(2)) if hd else None,
                 'f': g('fortitude'), 'r': g('reflex'), 'w': g('will'), 'init': g('init'), 'speed': g('speed'), 'melee': g('melee'), 'ranged': g('ranged'),
                 'space': g('space'), 'reach': g('reach'), 'sa': g('special_attacks'),
                 'ab': [g(k) for k in ('strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma')],
                 'bab': g('base_attack'), 'cmb': g('cmb'), 'cmd': g('cmd'), 'feats': g('feats'), 'skills': g('skills'), 'senses': g('senses'),
                 'sq': g('special_qualities'), 'dr': g('dr'), 'resist': g('resist'), 'immune': g('immune'), 'sr': g('sr'), 'da': g('defensive_abilities'),
                 'weak': g('weaknesses'), 'lang': g('languages'), 'al': g('alignment'), 'd': text(r['description'], 200)}
            monsters[name.lower()] = {k: v for k, v in m.items() if v not in ('', None, [])}

    # ---- animal companion statistics: starting form and its advancement (4th or 7th level)
    for r in c.execute("select s.section_id, s.name, s.parent_id, d.* from sections s join animal_companion_details d on d.section_id=s.section_id order by s.lft"):
        par = c.execute('select name from sections where section_id=?', (r['parent_id'],)).fetchone()
        name = clean(r['name'])
        if re.match(r'^(\d+(st|nd|rd|th)[- ]level advancement|starting statistics|animal companions?)$', name, re.I) and par:
            name = clean(par[0])
        name = re.sub(r'\s*\(animal companion\)$', '', name, flags=re.I)
        if not name:
            continue
        g = lambda k: text(r[k]) if r[k] else ''
        k = name.lower()
        e = companions.setdefault(k, {'n': name, 's': abbr})
        if e['s'] != abbr and 'start' in e and 'adv' in e:
            continue
        block = {x: g(y) for x, y in (('size', 'size'), ('speed', 'speed'), ('ac', 'ac'), ('atk', 'attack'), ('ab', 'ability_scores'), ('sq', 'special_qualities'),
                                      ('sa', 'special_attacks'), ('spab', 'special_abilities'), ('feat', 'bonus_feat'), ('cmd', 'cmd')) if g(y)}
        lv = re.match(r'(\d+)', g('level'))
        if lv:
            if 'adv' not in e:
                e['adv'] = dict(block, l=int(lv.group(1)))
        elif 'start' not in e:
            e['start'] = block

    # ---- mythic rules (Mythic Adventures): base abilities by tier, the six paths, universal path abilities
    if abbr == 'MA' and not mythic['paths']:
        sec = lambda name, parent=None: c.execute('select * from sections where name=? ' + ('and parent_id=?' if parent else '') + ' order by lft', (name, parent) if parent else (name,)).fetchone()
        tier_of = lambda nm: int(re.match(r'(\d+)', nm).group(1)) if re.match(r'\d+', nm) else 1
        ab = lambda x: {'n': re.sub(r'\s*\((Ex|Su|Sp)\)$', '', clean(x['name'])), 'd': text(x['body'] or x['description'], 900)}
        base = sec('Base Mythic Abilities')
        base = c.execute("select * from sections where name='Base Mythic Abilities' and type='section'").fetchone()
        if base:
            for k in kids(base['section_id']):
                a = ab(k)
                a['l'] = MYTHIC_BASE_TIER.get(a['n'].lower(), 1)
                mythic['base'].append(a)
        uni = c.execute("select * from sections where name='Universal Path Abilities'").fetchone()
        if uni:
            for g in kids(uni['section_id']):
                for k in kids(g['section_id']):
                    if k['type'] in ('ability', 'section'):
                        mythic['universal'].append(dict(ab(k), t=tier_of(clean(g['name']))))
        for pn in ('Archmage', 'Champion', 'Guardian', 'Hierophant', 'Marshal', 'Trickster'):
            # the path's own section is the one with a "Bonus Hit Points" part (other sections share the name)
            top = c.execute("select s.* from sections s where s.name=? and exists (select 1 from sections k where k.parent_id=s.section_id and k.name='Bonus Hit Points')", (pn,)).fetchone()
            if not top:
                continue
            path = {'n': pn, 's': abbr, 'd': text(top['body'], 600), 'hp': 0, 'feature': None, 'capstone': None, 'abilities': []}
            for k in kids(top['section_id']):
                kn = clean(k['name'])
                if re.match(r'^\d+(st|nd|rd|th)-Tier', kn):   # the trickster files its tiers here, not under its features
                    for x in kids(k['section_id']):
                        if x['type'] in ('ability', 'section') and not clean(x['name']).endswith('Builds'):
                            path['abilities'].append(dict(ab(x), t=tier_of(kn)))
                elif kn == 'Role':
                    path['role'] = text(k['body'], 500)
                elif kn == 'Bonus Hit Points':
                    m = re.search(r'gain (\d+) bonus hit points', text(k['body']))
                    path['hp'] = int(m.group(1)) if m else 0
                elif kn.endswith('Features'):
                    for f in kids(k['section_id']):
                        fn = clean(f['name'])
                        sub = kids(f['section_id'])
                        if re.match(r'^\d+(st|nd|rd|th)-Tier', fn):
                            for x in sub:
                                if x['type'] in ('ability', 'section'):
                                    path['abilities'].append(dict(ab(x), t=tier_of(fn)))
                        elif fn == 'Path Ability':
                            continue
                        elif sub and all(x['type'] == 'ability' for x in sub):
                            path['feature'] = {'n': fn, 'd': text(f['body'], 400), 'options': [ab(x) for x in sub]}
                        elif f['type'] == 'ability':
                            path['capstone'] = ab(f)
            mythic['paths'].append(path)

    # ---- races (Advanced Race Guide): ability modifiers, size, speed, senses, languages, bonuses and features
    for r in c.execute("select * from sections where type='race'"):
        if abbr != 'ARG':   # the Advanced Race Guide has every race, written the same way
            continue
        rn = race_singular(r['name'])
        if rn.lower() in races:
            continue
        rt = c.execute("select section_id from sections where parent_id=? and name like '%Racial Traits' and name not like 'Alternate%'", (r['section_id'],)).fetchone()
        if not rt:
            continue
        race = {'n': rn, 's': abbr, 'cat': (r['subtype'] or '').replace('_race', ''), 'size': 'Medium', 'speed': 30, 'speeds': {}, 'mods': {}, 'flex': False,
                'senses': [], 'languages': '', 'ranks': 0, 'bonuses': [], 'features': []}
        for k in kids(rt[0]):
            kn, kt = clean(k['name'] or ''), text(k['body'] or k['description'])
            sm = re.search(r'base speed of (\d+) feet', kt)   # also in "Slow and Steady"
            if sm:
                race['speed'] = int(sm.group(1))
                if re.search(r'never modified by armor or encumbrance', kt):
                    race['slow'] = True
            pairs = re.findall(r'([+\-\u2013\u2212])(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)', kn)
            if pairs:
                for sg, v, ab in pairs:
                    race['mods'][ABIL[ab.lower()]] = int(v) * (1 if sg == '+' else -1)
                if re.search(r'one ability score of (her|his|their) choice', kt, re.I):
                    race['flex'] = True
                continue
            if re.match(r'^\+2 to one ability score', kn, re.I):
                race['flex'] = True
                continue
            if kn in ('Fine', 'Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge'):
                race['size'] = kn
                continue
            if re.search(r'speed', kn, re.I):
                m = re.search(r'base speed of (\d+) feet', kt)
                if m:
                    race['speed'] = int(m.group(1))
                for mode in ('fly', 'swim', 'climb', 'burrow'):
                    mm = re.search(mode + r' speed of (\d+) feet', kt)
                    if mm:
                        race['speeds'][mode] = int(mm.group(1))
                race['features'].append([kn, kt])
                continue
            if re.match(r'^(superior darkvision|darkvision|low-light vision|see in darkness)$', kn, re.I):
                m = re.search(r'(\d+) feet', kt)
                race['senses'].append(kn.title() + (f' {m.group(1)} ft.' if m and 'darkvision' in kn.lower() else ''))
                continue
            if kn.lower() == 'languages':
                m = re.search(r'begin play speaking ([^.]+)\.', kt)
                if m:
                    race['languages'] = re.sub(r',?\s+and\s+', ', ', m.group(1))
                continue
            if re.search(r'additional skill rank', kt):
                race['ranks'] = 1
            found = False
            for m in re.finditer(r'\+(\d+) racial bonus on ([A-Z][\w ()]*?(?:,\s*(?:and\s+)?[A-Z][\w ()]*?)*(?:,?\s+and\s+[A-Z][\w ()]*?)?)(?: checks?)?(?=[.;]|\s+due\b|$)', kt):
                sk = skill_names(m.group(2))
                if sk:
                    for x in sk:
                        race['bonuses'].append({'label': kn, 'target': 'skill', 'skill': x, 'value': int(m.group(1))})
                    found = True
            m = re.search(r'\+(\d+) racial bonus on all saving throws\.', kt)
            if m:
                race['bonuses'].append({'label': kn, 'target': 'saves', 'value': int(m.group(1))})
                found = True
            m = re.search(r'\+(\d+) natural armor bonus', kt)
            if m:
                race['bonuses'].append({'label': kn, 'target': 'nat', 'value': int(m.group(1))})
                found = True
            if not found and re.search(r'bonus|penalty|resistance \d|immune', kt, re.I) and len(kt) < 400:
                race['bonuses'].append({'label': kn, 'target': 'note', 'value': '', 'text': kt})
            race['features'].append([kn, kt])
        race['senses'] = ', '.join(race['senses'])
        races[rn.lower()] = race

    # ---- class features by level (base classes)
    for cl in c.execute("select * from sections where type='class' and subtype in ('core','base','hybrid','prestige')"):
        cname = clean(cl['name'])
        if cname.lower() in classes:
            continue
        sub = c.execute('select * from sections where lft>? and rgt<? order by lft', (cl['lft'], cl['rgt'])).fetchall()
        tbl = next((x for x in sub if x['type'] == 'table' and 'Special' in (x['body'] or '') and 'Level' in (x['body'] or '')), None)
        if not tbl:
            continue
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tbl['body'], re.S)
        heads, levels = [], []
        for row in rows:
            ths = [text(x) for x in re.findall(r'<th[^>]*>(.*?)</th>', row, re.S)]
            if ths and 'Special' in ths:
                heads = ths
                continue
            tds = [text(x) for x in re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)]
            if heads and len(tds) >= len(heads) - 2 and tds and re.match(r'^\d+', tds[0]):
                sp = tds[heads.index('Special')] if heads.index('Special') < len(tds) else ''
                levels.append([s.strip() for s in re.split(r',(?![^(]*\))', sp) if s.strip() and s.strip() not in ('—', '-')])
        # feature descriptions: abilities directly in the class (not in domains/bloodlines lists)
        feats_by = {}
        cf = [x['section_id'] for x in sub if (x['name'] or '').endswith('Class Features')] + [cl['section_id']]
        for x in sub:
            if x['parent_id'] in cf and x['type'] in ('ability', 'section') and x['name'] and not (x['name'] or '').startswith(('Table', 'Class Features', 'Class Skills', 'Ex-', 'Role', 'Alignment', 'Hit Die', 'Starting Wealth', 'Parent Classes', 'Requirements')):
                    nm = re.sub(r'\s*\((Ex|Su|Sp)\)$', '', clean(x['name']))
                    feats_by[nm.lower()] = {'n': nm, 'd': text(x['body'] or x['description'], 500)}
        if levels:
            classes[cname.lower()] = {'n': cname, 's': abbr, 'levels': levels, 'f': feats_by}


def dump(name, store, sort=True):
    vals = sorted(store.values(), key=lambda v: v['n'].lower()) if sort else list(store.values())
    if isinstance(store, dict) and name == 'classes':
        vals = store
    with open(os.path.join(OUT, name + '.json'), 'w', encoding='utf-8') as f:
        json.dump(vals, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{name:8} {len(store):5}  {os.path.getsize(os.path.join(OUT, name + ".json")) / 1024:.0f} KB')


companions = {k: v for k, v in companions.items() if 'start' in v}
with open(os.path.join(OUT, 'mythic.json'), 'w', encoding='utf-8') as f:
    json.dump(mythic, f, ensure_ascii=False, separators=(',', ':'))
print(f"mythic    paths {len(mythic['paths'])}, base {len(mythic['base'])}, universal {len(mythic['universal'])}, path abilities {sum(len(x['abilities']) for x in mythic['paths'])}")
for n, s in [('feats', feats), ('traits', traits), ('spells', spells), ('items', items), ('gear', gear), ('weapons', weapons), ('armor', armor), ('classes', classes), ('archetypes', archetypes), ('choices', choices), ('races', races), ('monsters', monsters), ('companions', companions)]:
    dump(n, s)
