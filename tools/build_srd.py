"""Build compact SRD data files (data/srd/*.json) from PSRD-Data SQLite books.

PSRD-Data (https://github.com/devonjones/PSRD-Data, release branch) converts Paizo's Pathfinder RPG
Reference Document, which is Open Game Content under the OGL 1.0a (see OGL.txt).

Usage:
    python tools/build_srd.py <folder with book-*.db files> data/srd

Books read: cr, apg, um, uc, arg, acg, ucampaign, ue (earlier books win when a name repeats).
"""
import html, json, os, re, sqlite3, sys

SRC, OUT = sys.argv[1], sys.argv[2]
BOOKS = [('cr', 'CRB'), ('apg', 'APG'), ('um', 'UM'), ('uc', 'UC'), ('arg', 'ARG'), ('acg', 'ACG'), ('ucampaign', 'UCa'), ('ue', 'UE')]
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


feats, traits, spells, items, gear, weapons, armor, classes, archetypes = {}, {}, {}, {}, {}, {}, {}, {}, {}


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
        keep(items, name, {'n': name, 's': abbr, 'slot': (r['slot'] or '').strip(), 'p': prices(r['price']), 'w': num_weight(r['weight']),
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


for n, s in [('feats', feats), ('traits', traits), ('spells', spells), ('items', items), ('gear', gear), ('weapons', weapons), ('armor', armor), ('classes', classes), ('archetypes', archetypes)]:
    dump(n, s)
