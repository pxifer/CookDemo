"""Cache primary HTML pages for reproducible excerpt locators; no full-text redistribution."""
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'tmp' / 'health-sources'
SOURCES = {
    'shinoda-cooking-1982': 'https://www.jstage.jst.go.jp/article/jsnfs1949/35/2/35_2_103/_article/-char/en',
    'nci-cooked-meats-2017': 'https://www.cancer.gov/about-cancer/causes-prevention/risk/diet/cooked-meats-fact-sheet',
}

class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip = max(0, self.skip - 1)
    def handle_data(self, text):
        if not self.skip and text.strip(): self.parts.append(text.strip())

for key, url in SOURCES.items():
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=40) as response: data = response.read()
    (ROOT / (key + '.html')).write_bytes(data)
    parser = TextParser()
    parser.feed(data.decode('utf-8'))
    text = '\n'.join(parser.parts)
    (ROOT / (key + '.pages.json')).write_text(json.dumps([text], ensure_ascii=False, indent=2), encoding='utf-8')
    meta = {'id': key, 'url': url, 'retrieved_url': url, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'retrieved_date': '2026-10-28', 'pages': 1}
    (ROOT / (key + '.metadata.json')).write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(meta, ensure_ascii=False))
