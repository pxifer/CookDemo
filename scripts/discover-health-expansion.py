"""Read the national nutrition institute's public guideline catalogue and attachments."""
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from pathlib import Path
import hashlib
import json
import re
import sys

CACHE=Path(__file__).resolve().parents[1]/'artifacts/tmp/health-sources'
CACHE.mkdir(parents=True,exist_ok=True)
TERMS=('成人高脂血症食养指南','成人肥胖食养指南','成人慢性肾脏病食养指南','成人骨质疏松症食养指南')
class Links(HTMLParser):
    def __init__(self): super().__init__();self.links=[];self.current=None;self.texts=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a': self.current=[dict(attrs).get('href',''),[]]
    def handle_data(self,data):
        if data.strip():self.texts.append(data.strip())
        if self.current is not None:self.current[1].append(data)
    def handle_endtag(self,tag):
        if tag=='a' and self.current is not None:
            self.links.append((self.current[0],''.join(self.current[1]).strip()));self.current=None
def get(url):
    with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=35) as r:return r.read(),r.geturl()
def inspect(url):
    try:
        data,final=get(url);p=Links();html=data.decode('utf-8');p.feed(html)
        candidates=[{'title':title,'url':urljoin(final,href)} for href,title in p.links if any(t in re.sub(r'\s+','',title) for t in TERMS) or '.pdf' in href.lower() or '.rar' in href.lower()]
        embeds=re.findall(r'''(?:src|data|href)\s*=\s*["']([^"']+)["']''',html,re.I)
        (CACHE/(url.split('/')[-1]+'.html')).write_bytes(data)
        return {'url':url,'links':candidates,'attachments':[urljoin(final,s) for s in embeds if any(t in s.lower() for t in ['pdf','rar','p020','files'])]}
    except Exception as e:return {'url':url,'error':str(e)}
if __name__=='__main__':
    urls=sys.argv[1:] or ['https://www.chinanutri.cn/fgbz/fgbzjszn/','https://www.chinanutri.cn/fgbz/fgbzjszn/index_1.html']
    results=list(ThreadPoolExecutor(max_workers=4).map(inspect,urls))
    (CACHE/'expansion-discovery.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False,indent=2))
