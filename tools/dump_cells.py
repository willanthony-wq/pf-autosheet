import openpyxl, json, sys
wv = openpyxl.load_workbook(sys.argv[1], data_only=True)
wf = openpyxl.load_workbook(sys.argv[1])
out = {}
for name in ('Main Sheet', 'Welcome Page', 'Class Charts', 'Class Skills', 'Formula References'):
    if name not in wv.sheetnames: continue
    v = {}; f = {}
    for r in wv[name].iter_rows():
        for c in r:
            if c.value is not None: v[c.coordinate] = c.value if isinstance(c.value, (int, float, str, bool)) else str(c.value)
    for r in wf[name].iter_rows():
        for c in r:
            x = c.value
            if hasattr(x, 'text'): x = '=' + str(x.text).lstrip('=')
            if isinstance(x, str) and x.startswith('='): f[c.coordinate] = x
    out[name] = {'v': v, 'f': f, 'max': wv[name].max_row}
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'))
