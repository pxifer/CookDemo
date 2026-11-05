"""Verify new PDF bytes/locators and the image provenance of manually checked lipid excerpts."""
from pathlib import Path
from pypdf import PdfReader
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'artifacts/tmp/health-sources'
b=json.loads((ROOT/'datasets/health/2026-10-28-v2/knowledge-bundle.json').read_text(encoding='utf-8'))
old=json.loads((ROOT/'datasets/health/2026-10-28-v1/knowledge-bundle.json').read_text(encoding='utf-8'))
for field in ['sources','entities','evidence','facts','ruleDrafts','conflicts']:
    current={r['id']:r for r in b[field]}
    for r in old[field]:assert current[r['id']]==r,('v1 changed',field,r['id'])
pages={}
for s in b['sources']:
    if s['id'].startswith('cdc-dyslipidemia'):
        raw=CACHE/'t20250407_305765.html.html'
    else:raw=CACHE/(s['id']+('.html'if s['pageCount']==1 else'.pdf'))
    assert hashlib.sha256(raw.read_bytes()).hexdigest()==s['sourceHash'],s['id']
    if raw.suffix=='.pdf':pages[s['id']]=[p.extract_text()or''for p in PdfReader(raw).pages]
    elif s['id']!='cdc-dyslipidemia-2023':pages[s['id']]=json.loads((CACHE/(s['id']+'.pages.json')).read_text(encoding='utf-8'))
for e in b['evidence']:
    loc=e['locator']
    if loc['kind']=='html_visual':
        assets=json.loads((CACHE/'cdc-dyslipidemia-2023.assets.json').read_text(encoding='utf-8'))
        asset=next(a for a in assets if a['url']==loc['assetUrl'])
        assert hashlib.sha256((CACHE/asset['file']).read_bytes()).hexdigest()==loc['verifiedPageImageHash']
        x1,y1,x2,y2=loc['imageRegion'];assert 0<=x1<x2<=asset['size'][0]and 0<=y1<y2<=asset['size'][1]
    elif loc['kind']=='pdf_visual':
        img=CACHE/(e['sourceId']+'-p'+str(loc['pdfPage'])+'.png')
        assert hashlib.sha256(img.read_bytes()).hexdigest()==loc['verifiedPageImageHash']
    else:
        text=re.sub(r'\s+','',pages[e['sourceId']][(loc['pdfPage']or 1)-1])
        assert text[loc['start']:loc['end']]==e['originalSpan'],e['key']
op=next(s for s in b['sources']if s['id']=='nhc-osteoporosis-2026')
meta=json.loads((CACHE/'nhc-osteoporosis-2026.metadata.json').read_text(encoding='utf-8'))
assert hashlib.sha256((CACHE/'nhc-osteoporosis-2026.rar').read_bytes()).hexdigest()==meta['archiveHash']
assert op['archiveMember']==meta['archiveMember']
report=dict(state='verified',sources=len(b['sources']),evidence=len(b['evidence']),preservedV1Facts=len(old['facts']),newFacts=len(b['facts'])-len(old['facts']),visualExcerpts=sum(e['locator']['kind']=='html_visual'for e in b['evidence']),note='Character locators and original file/image hashes verified; the ten image excerpts were manually read, not claimed to be OCR. Not clinical review.')
out=ROOT/'artifacts/acceptance/health-knowledge-2026-10-28-v2';out.mkdir(parents=True,exist_ok=True)
(out/'source-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
