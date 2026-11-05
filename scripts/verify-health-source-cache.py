"""Verify local source bytes, normalized locators and the Total column in sampled rows."""
from pathlib import Path
import hashlib
import json
import re
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'artifacts/tmp/health-sources'
bundle=json.loads((ROOT/'datasets/health/2026-10-28-v1/knowledge-bundle.json').read_text(encoding='utf-8'))
compact=lambda s: re.sub(r'\s+','',s)
pages={}
for s in bundle['sources']:
    path=CACHE/(s['id']+('.html' if s['pageCount']==1 else '.pdf'))
    assert hashlib.sha256(path.read_bytes()).hexdigest()==s['sourceHash'],s['id']
    if s['pageCount']>1:
        pages[s['id']]=[p.extract_text() or '' for p in PdfReader(path).pages]
    else:
        pages[s['id']]=json.loads((CACHE/(s['id']+'.pages.json')).read_text(encoding='utf-8'))
for e in bundle['evidence']:
    loc=e['locator']
    if loc['kind']=='pdf_visual':
        img=CACHE/(e['sourceId']+'-p'+str(loc['pdfPage'])+'.png')
        assert hashlib.sha256(img.read_bytes()).hexdigest()==loc['verifiedPageImageHash']
    else:
        page=compact(pages[e['sourceId']][(loc['pdfPage'] or 1)-1])
        assert page[loc['start']:loc['end']]==e['originalSpan'],e['key']
byid={e['id']:e for e in bundle['evidence']}
checked=0
for f in bundle['facts']:
    q=f['quantity']
    if not q or q['kind']!='reported_measurement': continue
    e=byid[f['evidenceIds'][0]]
    text=pages[e['sourceId']][e['locator']['pdfPage']-1]
    lines=[line.strip() for line in text.splitlines() if re.match(re.escape(q['sourceFoodLabel'])+r'\s+\d',line.strip())]
    assert len(lines)==1,(q['sourceFoodLabel'],lines)
    suffix=lines[0][len(q['sourceFoodLabel']):].strip().split()
    # Adenine, Guanine, Hypoxanthine, Xanthine, Total, calculated uric acid, classification.
    assert len(suffix)==7,(q['sourceFoodLabel'],suffix)
    assert float(suffix[4])==q['value'],(q['sourceFoodLabel'],suffix,q)
    checked+=1
report=dict(state='source_cache_verified',sourceHashes=len(bundle['sources']),evidenceLocators=len(bundle['evidence']),measuredTotalColumnRows=checked,
    note='PDF normalized text and sample Total columns checked; visual table row transcribed after page-image inspection. This is source verification, not clinical review.')
out=ROOT/'artifacts/acceptance/health-knowledge-2026-10-28'
out.mkdir(parents=True,exist_ok=True)
(out/'source-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
