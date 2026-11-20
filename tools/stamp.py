"""Stamp a version onto the CSS/JS links in index.html so browsers fetch fresh files after each update.

GitHub Pages lets browsers cache files for 10 minutes. Changing the ?v= value on every release makes
browsers treat the files as new. Run before committing:  python tools/stamp.py
"""
import re, time, pathlib

index = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
version = time.strftime('%Y%m%d%H%M%S')
html = index.read_text(encoding='utf-8')
html, n = re.subn(r'((?:href|src)="(?:css|js)/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"', rf'\1?v={version}"', html)
index.write_text(html, encoding='utf-8')
print(f'stamped {n} links with v={version}')
