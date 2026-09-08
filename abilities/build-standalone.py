from pathlib import Path

root = Path(__file__).resolve().parent.parent
abilities = root / "abilities"
html = (abilities / "index.html").read_text()
page_css = (abilities / "styles.css").read_text()
app_js = (abilities / "app.js").read_text()
registry = (abilities / "abilities.json").read_text().strip()

html = html.replace('../favicon-16x16.png', '/favicon-16x16.png')
html = html.replace('../css/style.css', '/css/style.css')
html = html.replace('<link rel="stylesheet" href="styles.css" />', f'<style>{page_css}</style>')
html = html.replace('href="abilities.json"', 'href="https://tmsteph.vercel.app/abilities/abilities.json"')
html = html.replace('<script src="app.js"></script>', f'<script>window.__ABILITIES__={registry};</script>\n  <script>{app_js}</script>')
(root / "abilities.html").write_text(html)
print(f"wrote {root / 'abilities.html'}")