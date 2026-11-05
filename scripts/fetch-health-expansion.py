"""Download selected public authority PDFs; cache originals without redistributing full texts."""
from pathlib import Path, PurePosixPath
from urllib.parse import urljoin
from urllib.request import Request,urlopen
from pypdf import PdfReader
import hashlib,json,subprocess,re

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'artifacts/tmp/health-sources'
SOURCES={
 'nhc-obesity-2024':'https://www.hncdc.com/upload/1/cms/content/editor/1741857710156.pdf',
 'nhc-ckd-2024':'https://www.hncdc.com/upload/1/cms/content/editor/1741857710741.pdf',
 'nhc-osteoporosis-2026':'https://www.chinanutri.cn/fgbz/fgbzjszn/202605/P020260526508120776682.rar',
}
def fetch(key,url):
    path=CACHE/(key+'.pdf')
    metadata_path=CACHE/(key+'.metadata.json')
    if path.exists() and metadata_path.exists():
        previous=json.loads(metadata_path.read_text(encoding='utf-8'))
        if hashlib.sha256(path.read_bytes()).hexdigest()!=previous['sha256']:raise ValueError('Cached source hash changed')
        print(json.dumps(previous,ensure_ascii=False));return
    archive_url=None; archive_hash=None
    if path.exists():data=path.read_bytes()
    else:
        with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=50) as r:data=r.read()
        if url.endswith('.rar'):
            archive_url=url;archive_hash=hashlib.sha256(data).hexdigest()
            archive=CACHE/(key+'.rar');archive.write_bytes(data)
            listed=subprocess.run(['C:/Windows/System32/tar.exe','-tf',str(archive)],capture_output=True,check=True)
            try:members=listed.stdout.decode('utf-8').splitlines()
            except UnicodeDecodeError:members=listed.stdout.decode('gb18030').splitlines()
            for member in members:
                m=PurePosixPath(member.replace('\\','/'))
                if m.is_absolute() or '..' in m.parts or ':' in member:raise ValueError('Unsafe archive path')
            candidates=[m for m in members if m.lower().endswith('.pdf') and '问答' not in m]
            if len(candidates)!=1:raise ValueError('Select main PDF explicitly: '+repr(members))
            data=subprocess.run(['C:/Windows/System32/tar.exe','-xOf',str(archive),candidates[0]],capture_output=True,check=True).stdout
            print('archive_member',candidates[0])
    if not data.startswith(b'%PDF'):raise ValueError('Expected PDF')
    path.write_bytes(data)
    pages=[p.extract_text() or '' for p in PdfReader(path).pages]
    meta={'id':key,'url':url,'retrieved_url':url,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'retrieved_date':'2026-10-28','pages':len(pages)}
    if archive_url:meta.update(archiveUrl=archive_url,archiveHash=archive_hash,archiveMember=candidates[0])
    (CACHE/(key+'.metadata.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    (CACHE/(key+'.pages.json')).write_text(json.dumps(pages,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(meta,ensure_ascii=False))
if __name__=='__main__':
    failures=0
    for key,url in SOURCES.items():
        try:fetch(key,url)
        except Exception as error:failures+=1;print(key,type(error).__name__,str(error))
    try:
        from PIL import Image
        url='https://www.chinacdc.cn/jkyj/yyyjk2/jswj13949/202504/t20250407_305765.html'
        html=CACHE/'t20250407_305765.html.html'
        if not html.exists():
            with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=35)as r:html.write_bytes(r.read())
        assets=[]
        for i,src in enumerate(dict.fromkeys(re.findall(r'src="(\./[^\"]+\.jpg)"',html.read_text(encoding='utf-8'))),1):
            asset_url=urljoin(url,src);image=CACHE/('cdc-dyslipidemia-2023-'+str(i)+'.jpg')
            if not image.exists():
                with urlopen(Request(asset_url,headers={'User-Agent':'Mozilla/5.0'}),timeout=35)as r:image.write_bytes(r.read())
            assets.append(dict(url=asset_url,file=image.name,sha256=hashlib.sha256(image.read_bytes()).hexdigest(),size=Image.open(image).size))
        if len(assets)!=3:raise ValueError('Source image layout changed; review again before rebuilding')
        (CACHE/'cdc-dyslipidemia-2023.assets.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2),encoding='utf-8')
        print('cdc-dyslipidemia-2023: three source assets cached; manual verification required')
    except Exception as error:failures+=1;print(type(error).__name__,str(error))
    raise SystemExit(1 if failures else 0)
