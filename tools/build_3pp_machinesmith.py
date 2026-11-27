"""Build data/3pp/*.json for the Machinesmith (Louis Porter Jr. Design, Open Game Content) from d20pfsrd pages saved as text.
Usage: python gen_msmith.py <folder with main.txt, g_*.txt, a_*.txt, sp/*.txt> <repo data/3pp folder>
"""
import json, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
S = 'NeoExodus'
rd = lambda p: open(os.path.join(SRC, p), encoding='utf-8').read()


def clean(t):
    t = t.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('–', '-').replace('—', '-')
    t = re.sub(r'[ \t]+', ' ', t)
    return re.sub(r'\s*\n\s*', '\n', t).strip()


def body(txt):
    """Text from the '# Title' line to the Section 15 notice."""
    m = re.search(r'^# .*$', txt, re.M)
    t = txt[m.start():] if m else txt
    t = re.split(r'\n\s*Section 15: Copyright Notice|\n#### Discuss!', t)[0]
    return t


def sections(t, level='####'):
    """[(heading, text)] for '#### Heading' sections."""
    parts = re.split(r'^%s (.+)$' % level, t, flags=re.M)
    out = []
    for i in range(1, len(parts), 2):
        out.append((parts[i].strip(), clean(re.split(r'\n## ', parts[i + 1])[0])))   # stop at the next top-level heading
    return out


main = rd('main.txt')

# ---------------------------------------------------------------- class features
feat = dict(sections(main))
proto_list = clean(main[main.index('### Machinesmith Prototype List') + len('### Machinesmith Prototype List'):main.index('Machinesmiths can forge steel')])
proto_list = re.sub(r'(\d)(st|nd|rd|th)-Level\n', r'\1\2 level: ', proto_list)
prot = feat['Prototypes (Su)']
prot = prot[prot.index('Machinesmiths can forge steel'):] if 'Machinesmiths can forge steel' in prot else prot   # the list itself goes first, once
gw = re.sub(r'^Subpages\nArchetypes\nGreatworks\n', '', feat['Greatworks (Su)'])
F = {
    'weapon and armor proficiency': ('Weapon and Armor Proficiency', feat['Weapon and Armor Proficiency']),
    'crafter': ('Crafter', feat['Crafter (Ex)']),
    'prototypes': ('Prototypes', 'Prototype list: ' + proto_list.replace('\n', '; ') + '\n' + prot),
    'repair': ('Repair', feat['Repair (Su)']),
    'greatworks': ('Greatworks', gw + '\nPick the greatwork as a class choice (Character tab) to add its abilities by level.'),
    'greatwork upgrade': ('Greatwork upgrade', 'At 5th, 10th, 15th and 20th level the machinesmith upgrades his greatwork. Upgrades must be performed in order; abilities of earlier upgrades remain and stack. When installing a new upgrade he may reconfigure earlier design decisions (such as damage types). Each greatwork\'s upgrades are listed under that greatwork.'),
    'trapfinding': ('Trapfinding', feat['Trapfinding (Ex)']),
    'machinesmith trick': ('Machinesmith Trick', feat['Machinesmith Trick']),
    'crafting expertise': ('Crafting Expertise', feat['Crafting Expertise (Su)']),
    'axiom': ('Axiom', feat['Axiom (Su)']),
}
LEVELS = [
    ['Crafter', 'Greatwork', 'Prototypes', 'Repair 1d6'], ['Machinesmith trick', 'Trapfinding'], ['Crafting expertise', 'Repair 2d6'],
    ['Machinesmith trick'], ['Repair 3d6', 'Greatwork upgrade 1'], ['Machinesmith trick'], ['Axiom', 'Repair 4d6'], ['Machinesmith trick'],
    ['Repair 5d6'], ['Greatwork upgrade 2', 'Machinesmith trick'], ['Repair 6d6'], ['Machinesmith trick'], ['Repair 7d6'], ['Machinesmith trick'],
    ['Repair 8d6', 'Greatwork upgrade 3'], ['Machinesmith trick'], ['Repair 9d6'], ['Machinesmith trick'], ['Repair 10d6'],
    ['Greatwork upgrade 4 (master)', 'Machinesmith trick'],
]
classes = {'machinesmith': {'n': 'Machinesmith', 's': S, 'levels': LEVELS, 'f': {k: {'n': n, 'd': d} for k, (n, d) in F.items()}}}

# ---------------------------------------------------------------- tricks
ORD = r'(\d+)(?:st|nd|rd|th)'
choices = []
trick_part = main[main.index('#### Augmentations (Analyzer)'):main.index('#### Crafting Expertise (Su)')]
GROUPS = {'Augmentations (Analyzer)': 'Augmentation (Analyzer)', 'Augmentations (Constructor)': 'Augmentation (Constructor)',
          'Augmentations (Converter)': 'Augmentation (Converter)', 'Augmentations (Mechanus)': 'Augmentation (Mechanus)',
          'Augmentations (Mobius Weapons)': 'Augmentation (Mobius weapon)', 'Gadgets': 'Gadget', 'Techniques': 'Technique'}
head_re = re.compile(r"^([A-Z][A-Za-z' ,\-]+?) \((Ex|Su|Sp)\): ?(.*)$")
for grp, txt in sections(trick_part):
    g = GROUPS[grp]
    cur = None
    for line in txt.split('\n'):
        m = head_re.match(line.strip())
        if m:
            cur = {'n': m.group(1).strip(), 't': m.group(2), 'lines': [m.group(3)]}
            choices.append((g, cur))
        elif cur:
            cur['lines'].append(line.strip())
tricks = []
for g, x in choices:
    d = '\n'.join(l for l in x['lines'] if l)
    src = S
    if re.search(r'\s*Source NC:WoMD\s*', d):
        src = 'NeoExodus WoMD'
        d = re.sub(r'\s*Source NC:WoMD\s*', ' ', d).strip()
    lv = re.search(r'at least ' + ORD + ' level', d)
    kind = g.split(' (')[0].lower()
    tricks.append({'n': x['n'], 'c': 'machinesmith', 'g': g, 'k': 'talent', 's': src, 'd': f"({x['t']}) {d}", 'l': int(lv.group(1)) if lv else 1})

# ---------------------------------------------------------------- greatworks (paths with powers by level)
paths = []
UP = {'Base': 1, 'Upgrade 1': 5, 'Upgrade 2': 10, 'Upgrade 3': 15, 'Master Upgrade': 20}
for fn, name in [('g_analyzers.txt', 'Analyzer'), ('g_constructors.txt', 'Constructor'), ('g_mechanus.txt', 'Mechanus'), ('g_mobius-weapons.txt', 'Mobius Weapon')]:
    t = body(rd(fn))
    intro = clean(re.split(r'^#### ', t.split('\n', 1)[1], maxsplit=1, flags=re.M)[0])
    intro = '\n'.join(p.lstrip('# ') for p in intro.split('\n') if not p.startswith('At 5th and every five levels'))
    secs = sections(t)
    powers, extra = [], []
    for h, x in secs:
        key = None
        for k in UP:
            if h == f'{k} {name}' or h == f'{name} {k}' or (k == 'Base' and h.startswith('Base ')):
                key = k
        if key:
            # Names without trailing numbers: the sheet treats "Upgrade 1" and "Upgrade 2" as one feature at two levels
            label = {'Base': 'Base abilities', 'Upgrade 1': 'First upgrade', 'Upgrade 2': 'Second upgrade', 'Upgrade 3': 'Third upgrade', 'Master Upgrade': 'Master upgrade'}[key]
            powers.append({'n': label, 'l': UP[key], 'd': re.sub(r'^A machinesmith may add this upgrade to their \w+ greatwork at \d+\w+ level\. ', '', x)})
        else:
            extra.append((h, x))
    if name == 'Mechanus':
        # base forms and the Table: Mechanus go with the base power
        def form(h, x):
            x = re.sub(r'\s*\n\s*', ' ', x).replace('Starting Statistics ', '').strip()
            x = x.replace(' *A humanoid mechanus has arms and hands.', ' (It has arms and hands.)')
            return f'{h.rstrip("*")}: {x}'
        forms = [form(h, x) for h, x in extra if h.rstrip('*') in ('Aquatic', 'Humanoid', 'Quadruped/Tracked/Wheeled', 'Serpentine')]
        # Table: Mechanus, from the class PDF: level, HD, BAB, save, armor bonus, Str/Dex bonus, special
        T = ('1,1,+1,+0,+2,+0,|2,2,+2,+0,+2,+1,Share trick|3,3,+3,+1,+3,+1,|4,3,+3,+1,+3,+1,|5,4,+4,+1,+4,+2,1st upgrade|6,5,+5,+1,+4,+2,|'
             '7,6,+6,+2,+5,+3,Share trick|8,6,+6,+2,+5,+3,|9,7,+7,+2,+6,+3,|10,8,+8,+3,+6,+4,2nd upgrade|11,9,+9,+3,+7,+4,|12,9,+9,+3,+7,+5,Share trick|'
             '13,10,+10,+3,+8,+5,|14,11,+11,+4,+8,+5,|15,12,+12,+4,+9,+6,3rd upgrade|16,12,+12,+4,+9,+6,|17,13,+13,+4,+10,+7,Share trick|'
             '18,14,+14,+5,+10,+7,|19,15,+15,+5,+11,+7,|20,15,+15,+5,+11,+8,Master upgrade')
        rows = [r.split(',') for r in T.split('|')]
        table = '\n'.join(f'Level {r[0]}: {r[1]} HD, BAB {r[2]}, saves {r[3]}, armor bonus {r[4]}, Str/Dex {r[5]}' + (f' ({r[6]})' if r[6] else '') for r in rows)
        notes = '\n'.join(f'{h}: {x}' for h, x in extra if h in ('HD', 'BAB', 'Saves', 'Armor Bonus', 'Str/Dex Bonus', 'Share Trick (Ex)'))
        base_d = 'Base forms (choose one; it can\'t change later):\n' + '\n'.join(forms) + '\nBonus HP for size: Medium 20, Large 30, Huge 40.\nTable: Mechanus (by machinesmith level)\n' + table + '\n' + notes + '\nOn this sheet: add the mechanus on the Companion tab as kind "Other" (HD d10, full BAB, no good saves, Con "-").'
        powers.insert(0, {'n': 'Base abilities', 'l': 1, 'd': base_d})
    paths.append({'n': name, 'c': 'machinesmith', 'g': 'Greatwork', 'k': 'path', 's': S, 'd': intro, 'p': powers})

# ---------------------------------------------------------------- archetypes
archetypes = []
for fn in sorted(f for f in os.listdir(SRC) if f.startswith('a_') and f.endswith('.txt')):
    t = body(rd(fn))
    title = re.search(r'^# (.+)$', t, re.M).group(1).strip()
    intro = clean(re.split(r'^#### ', t.split('\n', 1)[1], maxsplit=1, flags=re.M)[0])
    intro = '\n'.join(p for p in intro.split('\n') if 'is an archetype of the machinesmith class' not in p)
    abil = []
    for h, x in sections(t):
        nm = re.sub(r'\s*\((Ex|Su|Sp)\)$', '', h)
        lv = re.search(r'(?:^|\b)(?:At|Beginning at|at) ' + ORD + r' level', x)
        rep = re.findall(r'This ability replaces ([^.]+)\.', x)
        r, m = [], []
        for rr in rep:
            rr = rr.strip().lower()
            tm = re.search(ORD + r'[ -]level machinesmith trick', rr)
            if tm:
                r.append(f'machinesmith trick gained at {tm.group(1)}{"st" if tm.group(1).endswith("1") and tm.group(1) != "11" else "nd" if tm.group(1).endswith("2") and tm.group(1) != "12" else "th"} level')
            elif 'greatwork ability' in rr:
                r.append('greatworks')
            elif '15th level upgrade' in rr:
                r.append('greatwork upgrade gained at 15th level')
            elif 'master upgrade' in rr:
                r.append('greatwork upgrade gained at 20th level')
            else:
                r.append(re.sub(r"^(the |his )", '', rr))
        if not rep:
            if nm.lower() == 'greatwork':
                m.append('greatworks')
            elif 'prototypes' in nm.lower():
                m.append('prototypes')
        abil.append({'n': nm, 'l': int(lv.group(1)) if lv else 1, 'd': x, 'r': r, 'm': m})
    archetypes.append({'n': title, 'c': 'machinesmith', 's': S, 'd': intro, 'a': abil})

# ---------------------------------------------------------------- new prototypes (spells)
spells = []
ROMAN = {'2': 'II', '3': 'III'}


def parse_spell(name, x, src):
    g = lambda pat: (re.search(pat, x, re.M) or [None, ''])[1].strip()
    sch = re.search(r'School ([^;]+); Level ([^\n]+)', x)
    sv = g(r'Saving Throw ([^;\n]+)')
    sr = g(r'Spell Resistance ([^\n]+)')
    desc = x.split('DESCRIPTION', 1)[1] if 'DESCRIPTION' in x else ''
    desc = clean(desc)
    desc = re.sub(r'^Note on the Construct subschool:[^\n]*\n', '', desc)
    first = re.split(r'(?<=[.!?])\s', desc.replace('\n', ' '))
    summary = ''
    for s_ in first:
        if len(summary) + len(s_) > 320 and summary:
            break
        summary = (summary + ' ' + s_).strip()
    lv = sch.group(2).strip() if sch else ''
    lv = '; '.join(p.strip()[0].upper() + p.strip()[1:] if p.strip() else p for p in re.sub(r'(\D) (\d)', r'\1: \2', lv).split(','))
    return {'n': name, 's': src, 'sc': sch.group(1).strip() if sch else '', 'lv': lv, 'ct': g(r'Casting Time ([^\n]+)'),
            'r': g(r'^\s*Range ([^\n]+)'), 'du': g(r'Duration ([^\n]+)'), 'sv': sv, 'sr': sr, 'd': summary}


for fn in sorted(os.listdir(os.path.join(SRC, 'sp'))):
    if not fn.endswith('.txt'):
        continue
    t = body(rd(os.path.join('sp', fn)))
    title = re.search(r'^# (.+)$', t, re.M).group(1).strip()
    src = 'Rite Publishing' if fn.startswith('program-feat') else S
    variants = re.split(r'^#### (.+)$', t, flags=re.M)
    first = variants[0]
    spells.append(parse_spell(title, first, src))
    for i in range(1, len(variants), 2):
        vn = variants[i].strip()
        vm = re.match(r'(.*?) (\d)$', vn)
        if vm:
            vn = f'{vm.group(1)} {ROMAN.get(vm.group(2), vm.group(2))}'
        spells.append(parse_spell(vn, variants[i + 1], src))

# Machinesmith levels from the prototype list, for spells whose page doesn't name the class
plv = {}
for part in proto_list.split('\n'):
    m = re.match(r'(\d)\w\w level: (.*)', part)
    if m:
        for nm in m.group(2).split(','):
            plv[nm.strip().lower()] = int(m.group(1))
skey = lambda n: n.lower().replace(', improved', ' (improved)')
for sp in spells:
    if 'Machinesmith' not in sp['lv'] and skey(sp['n']) in plv:
        sp['lv'] = f"Machinesmith: {plv[skey(sp['n'])]}; " + sp['lv']
core = sorted(k for k in plv if not any(k == skey(s_['n']) for s_ in spells))
print('prototype list entries that must be core SRD spells:', core)
# Core spells on the prototype list: add "Machinesmith: N" to the SRD spell's levels (srd.js merges entries marked add)
for k in core:
    spells.append({'n': k, 'lv': f'Machinesmith: {plv[k]}', 'add': True})
json.dump(classes, open(os.path.join(OUT, 'classes.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(paths + tricks, open(os.path.join(OUT, 'choices.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(archetypes, open(os.path.join(OUT, 'archetypes.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(spells, open(os.path.join(OUT, 'spells.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('features', len(F), 'tricks', len(tricks), 'greatworks', [(p['n'], [(x['n'], x['l']) for x in p['p']]) for p in paths])
print('archetypes', [(a['n'], [(b['n'], b['l'], b['r'], b['m']) for b in a['a']]) for a in archetypes])
print('spells', [(s['n'], s['lv']) for s in spells])
from collections import Counter
print(Counter(t['g'] for t in tricks))
print([(t['n'], t['l']) for t in tricks if t['l'] > 1])
