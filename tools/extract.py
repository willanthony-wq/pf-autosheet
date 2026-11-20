"""Extract reference data from the Pathfinder Autosheet v6.2.1 workbook into js/data.js."""
import json, re, sys
import openpyxl
from openpyxl.utils import column_index_from_string as ci, get_column_letter as cl

src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src)
wv = openpyxl.load_workbook(src, data_only=True)

def num(v):
    if isinstance(v, (int, float)):
        return int(v) if float(v).is_integer() else round(float(v), 4)
    return None

def txt(v):
    if v is None: return None
    if hasattr(v, 'text'): v = v.text
    s = str(v).strip()
    return s or None

# ---------- Classes ----------
cc, ccv = wb['Class Charts'], wv['Class Charts']
def ref_of(v):
    s = txt(v)
    if not s: return None
    m = re.match(r'^\$?([A-Z]+)\$?(\d+)$', s)
    if m: return m.group(1) + m.group(2)
    m = re.search(r'ROW\(\$?([A-Z]+)\$?(\d+)\)', s)
    if m: return m.group(1) + m.group(2)
    return None

classes, refs = [], set()
for r in range(1, cc.max_row + 1):
    name, hd = txt(cc.cell(r, 2).value), num(cc.cell(r, 3).value)
    if not name or hd is None or name.startswith('['):
        continue
    saves = {txt(cc.cell(r, k).value) for k in (5, 6, 7)}
    if not saves <= {'Good', 'Poor', 'Prestige Good', 'Prestige Poor'}:
        continue
    stat = txt(cc.cell(r, 9).value)
    if stat and not re.match(r'^[A-Z]{3}$', stat): stat = None
    pd, kn = ref_of(cc.cell(r, 10).value), ref_of(cc.cell(r, 11).value)
    knv = txt(cc.cell(r, 11).value)
    for x in (pd, kn):
        if x: refs.add(x)
    classes.append({
        'cat': txt(cc.cell(r, 1).value) or 'Base', 'name': name, 'hd': hd,
        'bab': num(cc.cell(r, 4).value) or 0,
        'fort': txt(cc.cell(r, 5).value), 'ref': txt(cc.cell(r, 6).value), 'will': txt(cc.cell(r, 7).value),
        'skills': num(cc.cell(r, 8).value) or 0, 'stat': stat,
        'perDay': pd, 'known': kn if kn else (knv if knv in ('Spellbook', 'Divine') else None),
    })

def table_at(ref):
    m = re.match(r'([A-Z]+)(\d+)', ref)
    c0, r0 = ci(m.group(1)), int(m.group(2))
    rows = []
    for lv in range(1, 21):
        row = []
        for sl in range(10):
            v = ccv.cell(r0 + lv, c0 + 1 + sl).value
            n = num(v)
            row.append(n if n is not None else ('inf' if v == '∞' else None))
        rows.append(row)
    return rows

spell_tables = {ref: table_at(ref) for ref in sorted(refs)}

# ---------- Class skills ----------
cs = wb['Class Skills']
skill_cols = {}
for c in range(2, cs.max_column + 1):
    n = txt(cs.cell(1, c).value)
    if n: skill_cols[c] = n
skill_meta = {}
for c, n in skill_cols.items():
    m = skill_meta.setdefault(n, {'ability': txt(cs.cell(3, c).value), 'trained': False, 'acp': False})
    if txt(cs.cell(2, c).value) == 'Trained Only': m['trained'] = True
    if txt(cs.cell(4, c).value) == 'Armor Penalty': m['acp'] = True
class_skills = {}
for r in range(5, cs.max_row + 1):
    cname = txt(cs.cell(r, 1).value)
    if not cname or cname.isupper(): continue
    marks = set()
    for c, n in skill_cols.items():
        v = txt(cs.cell(r, c).value)
        if v == 'X' or v == 'x': marks.add(n)
    if 'Craft:' in marks or 'Perform:' in marks: marks.add('Artistry:')
    if marks: class_skills[cname] = sorted(marks)

# ---------- Formula References ----------
fr, frv = wb['Formula References'], wv['Formula References']
skill_lists = {}
for c in range(1, 6):
    key = txt(fr.cell(271, c).value)
    lst = [txt(fr.cell(r, c).value) for r in range(272, 309)]
    skill_lists[key] = [s for s in lst if s]

def w(c): return {'Unarmored': 0, 'Light': 1, 'Medium': 2, 'Heavy': 3}.get(c)
armor = []
for r in range(150, 197):
    n = txt(fr.cell(r, 1).value)
    if not n or n.startswith('~'): continue
    armor.append({'name': n, 'ac': num(fr.cell(r, 2).value) or 0, 'maxDex': num(fr.cell(r, 3).value),
                  'acp': num(fr.cell(r, 4).value) or 0, 'asf': num(fr.cell(r, 5).value) or 0,
                  'type': txt(fr.cell(r, 6).value), 'cat': txt(fr.cell(r, 7).value), 'mat': txt(fr.cell(r, 8).value)})
shields = []
for r in range(199, 207):
    n = txt(fr.cell(r, 1).value)
    if not n: continue
    shields.append({'name': n, 'ac': num(fr.cell(r, 2).value) or 0, 'maxDex': num(fr.cell(r, 3).value),
                    'acp': num(fr.cell(r, 4).value) or 0, 'asf': num(fr.cell(r, 5).value) or 0, 'type': txt(fr.cell(r, 6).value)})
materials = []
for r in range(209, 233):
    n = txt(fr.cell(r, 1).value)
    if not n: continue
    note = txt(fr.cell(r, 7).value)
    if note and note.startswith('='):
        note = {'Adamantine': 'DR 1-3/- (by armor weight)', 'Elysian Bronze': 'DR 1-3/- vs. creatures (by armor weight)',
                'Horacalcum': '+1-3 Initiative (by armor weight)'}.get(n, None)
    materials.append({'name': n, 'ac': num(fr.cell(r, 2).value) or 0, 'maxDex': num(fr.cell(r, 3).value) or 0,
                      'acp': num(fr.cell(r, 4).value) or 0, 'asf': num(fr.cell(r, 5).value) or 0,
                      'type': txt(fr.cell(r, 6).value), 'note': note, 'shield': txt(fr.cell(r, 8).value) == 'Shield',
                      'weight': num(fr.cell(r, 9).value) or 0})

# Conditions: columns B..U
cond_cols = {2: 'ac', 3: 'str', 4: 'dex', 5: 'con', 6: 'int', 7: 'wis', 8: 'cha', 9: 'fort', 10: 'ref', 11: 'will',
             12: 'mAtk', 13: 'mDmg', 14: 'rAtk', 15: 'rDmg', 16: 'skills', 17: 'cl', 18: 'speedMult', 19: 'chargeMult',
             20: 'runMult', 21: 'skillText'}
conditions = []
for r in range(237, 265):
    n = txt(fr.cell(r, 1).value)
    if not n: continue
    e = {'name': n}
    for c, k in cond_cols.items():
        v = fr.cell(r, c).value
        if v is None: continue
        if isinstance(v, str) and v.startswith('=-Dexterity'):
            e[k] = 'LOSEDEX' + v[len('=-Dexterity'):]
        elif k == 'speedMult' and isinstance(v, str):
            e[k] = float(v.lstrip('x'))
        else:
            e[k] = num(v) if num(v) is not None else txt(v)
    conditions.append(e)

# Attack categories: row 44 headings at C, F, I, ... each 3 wide
def tr(f):
    """Translate a Sheets attack formula into a JS expression over `v`."""
    if f is None: return None
    s = txt(f)
    if s.startswith('=IFERROR(__xludf.DUMMYFUNCTION('):
        inner = re.search(r'DUMMYFUNCTION\("(.*)"\),', s, re.S).group(1).replace('""', '"')
        inner = inner.replace('if(or(arrayformula(regexmatch(\'Main Sheet\'!$AE$2:$AE$4,"Monk \\(Unchained\\)"))),', 'IF(v.unchainedMonk,')
        s = '=' + inner
    s = s[1:]
    if s.strip() == '1/0': return None
    reps = [
        (r"iferror\(vlookup\(\"Monk\",'Main Sheet'!\$?AE\$?2:\$?AQ\$?4,13,false\),\"\"\)", 'v.monkLevel'),
        (r"iferror\(vlookup\(\"Monk\",'Main Sheet'!\$?AE\$?2:\$?AQ\$?4,9,false\),\"\"\)", 'v.monkBab'),
        (r"VLOOKUP\(Size,SizeTable,3,false\)", 'v.sizeAtk'),
        (r"VLOOKUP\(Size,SizeTable,4,false\)", 'v.sizeCmb'),
        (r"'Main Sheet'!\$D\$68", 'v.cl'), (r"'Main Sheet'!\$G\$52", 'v.castMod'),
        (r"'Main Sheet'!\$AQ\$2", 'v.class1Level'), (r"'Main Sheet'!\$AM\$2", 'v.class1Bab'),
        (r"'Main Sheet'!\$AH\$96", 'v.twf'), (r"'Main Sheet'!\$BG\$16", 'v.bab'),
        (r'\bBaseAttack\b', 'v.bab'), (r'\bStrength\b', 'v.str'), (r'\bDexterity\b', 'v.dex'),
        (r'\bConstitution\b', 'v.con'), (r'\bIntelligence\b', 'v.int'), (r'\bWisdom\b', 'v.wis'), (r'\bCharisma\b', 'v.cha'),
        (r'\b(tMeleeAttack|tMeleeDamage|tOHDamage|t2HDamage|tRangedAttack|tRangedDamage)\b', r'v.\1'),
        (r'(?i)\brounddown\(', 'RD('), (r'(?i)\bint\(', 'FL('), (r'(?i)\bmax\(', 'MAX('), (r'(?i)\bif\(', 'IF('),
    ]
    for a, b in reps: s = re.sub(a, b, s)
    if re.search(r"'|\$|vlookup", s, re.I):
        raise ValueError('untranslated: ' + s)
    return s

categories = []
c = 3
while c <= ci('AF'):
    name = txt(fr.cell(44, c).value)
    if name:
        it = fr.cell(44, c + 2).value
        iters = tr(it) if isinstance(it, str) and it.startswith('=') else str(int(float(it or 1)))
        opts = []
        for r in range(45, 70):
            lab = txt(fr.cell(r, c).value)
            if not lab or set(lab) <= set('~-'): continue
            opts.append({'label': lab, 'atk': tr(fr.cell(r, c + 1).value), 'dmg': tr(fr.cell(r, c + 2).value)})
        categories.append({'name': name, 'iter': iters, 'options': opts})
    c += 3

bonus_types = [txt(fr.cell(r, 1).value) for r in range(97, 110)]

data = {
    'version': 'v6.2.1', 'classes': classes, 'spellTables': spell_tables, 'skillMeta': skill_meta,
    'classSkills': class_skills, 'skillLists': skill_lists, 'armor': armor, 'shields': shields,
    'materials': materials, 'conditions': conditions, 'attackCategories': categories, 'bonusTypes': bonus_types,
}
with open(out, 'w', encoding='utf-8') as f:
    f.write('// Generated from Pathfinder Autosheet v6.2.1 by extract.py. Do not edit by hand.\n')
    f.write('window.PF_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('classes', len(classes), 'tables', len(spell_tables), 'classSkills', len(class_skills),
      'armor', len(armor), 'shields', len(shields), 'materials', len(materials), 'conditions', len(conditions),
      'categories', [(x['name'], len(x['options'])) for x in categories])
