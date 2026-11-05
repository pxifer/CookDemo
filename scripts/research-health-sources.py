"""Fetch public guideline attachments for local source verification (no personal data)."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import urllib.request
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts/tmp' / 'health-sources'
CACHE.mkdir(parents=True, exist_ok=True)
SOURCES = {
    'nhc-hypertension-2023': 'https://www.nhc.gov.cn/cms-search/downFiles/63f752a17cfd4b4781f744477561866f.pdf',
    'nhc-diabetes-2023': 'https://www.nhc.gov.cn/cms-search/downFiles/4fcbecd2c18e46baaf291bf46c2b79cd.pdf',
    'nhc-gout-2024': 'https://hncdc.com/upload/1/cms/content/editor/1741857707075.pdf',
    'kaneko-purines-2014': 'https://www.jstage.jst.go.jp/article/bpb/37/5/37_b13-00967/_pdf',
    'nhc-hypertension-principles-2024': 'https://www.gov.cn/zhengce/zhengceku/202407/P020240701700333981869.pdf',
}

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read(), response.geturl()

if __name__ == '__main__':
    print({name: bool(importlib.util.find_spec(name)) for name in ['pypdf', 'pdfplumber', 'fitz']})
    for key, url in SOURCES.items():
        try:
            cached = CACHE / (key + '.pdf')
            data, final = (cached.read_bytes(), url) if cached.exists() else fetch(url)
            if not data.startswith(b'%PDF'):
                html = data.decode('utf-8')
                links = re.findall(r'''href=["']([^"']+\.pdf[^"']*)''', html, flags=re.I)
                if not links:
                    print(key, 'no PDF links', html[-1500:])
                    continue
                url = urljoin(final, links[0])
                data, final = fetch(url)
            if not data.startswith(b'%PDF'):
                raise ValueError('Not a PDF response')
            path = CACHE / (key + '.pdf')
            path.write_bytes(data)
            meta = {'id': key, 'url': url, 'retrieved_url': final, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'retrieved_date': '2026-10-28'}
            try:
                from pypdf import PdfReader
                pages = [p.extract_text() or '' for p in PdfReader(path).pages]
            except ImportError:
                import fitz
                pages = [p.get_text() for p in fitz.open(path)]
            meta['pages'] = len(pages)
            (CACHE / (key + '.pages.json')).write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding='utf-8')
            (CACHE / (key + '.metadata.json')).write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
            print(json.dumps(meta, ensure_ascii=False))
            # Text is stored as UTF-8 JSON; keep terminal output bounded.
        except Exception as error:
            print(key, type(error).__name__, str(error))
