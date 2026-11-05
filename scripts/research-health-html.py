"""Check cached public HTML; downloading missing originals requires --fetch."""
from argparse import ArgumentParser
from pathlib import Path
from datetime import date
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'artifacts/tmp' / 'health-sources'
SOURCES = {
    'shinoda-cooking-1982': 'https://www.jstage.jst.go.jp/article/jsnfs1949/35/2/35_2_103/_article/-char/en',
    'nci-cooked-meats-2017': 'https://www.cancer.gov/about-cancer/causes-prevention/risk/diet/cooked-meats-fact-sheet',
}

def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--cache', type=Path, default=ROOT)
    args = parser.parse_args()
    for key, url in SOURCES.items():
        path = args.cache / (key + '.html')
        metadata_path = args.cache / (key + '.metadata.json')
        if path.exists():
            data = path.read_bytes()
            if metadata_path.exists() and json.loads(metadata_path.read_text(encoding='utf-8'))['sha256'] != hashlib.sha256(data).hexdigest():
                raise ValueError('CACHED_HTML_HASH_CHANGED')
        elif not args.fetch:
            raise ValueError('HTML_CACHE_MISSING_FETCH_NOT_AUTHORIZED')
        else:
            request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(request, timeout=40) as response:
                data = response.read()
            data.decode('utf-8-sig', errors='strict')
            args.cache.mkdir(parents=True, exist_ok=True)
            with path.open('xb') as stream:
                stream.write(data)
            meta = {'id': key, 'url': url, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'retrieved_date': date.today().isoformat()}
            with metadata_path.open('x', encoding='utf-8') as stream:
                stream.write(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'id': key, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'derivedText': 'use rebuild-health-sources.py; old pages and locators not overwritten'}))


if __name__ == '__main__':
    main()
