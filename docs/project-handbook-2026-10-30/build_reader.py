"""Build the local, dependency-free reading edition; no network or project tests."""
from pathlib import Path
import hashlib
import html
import json
import re

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / '拾味项目全解_架构实现与面试答辩.md'
TARGET = ROOT / '拾味项目全解_阅读版.html'
text = SOURCE.read_text(encoding='utf-8')
headings = []


def inline(value):
    pattern = r'(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)'
    parts = []
    for part in re.split(pattern, value):
        if part.startswith('`') and part.endswith('`'):
            parts.append('<code>' + html.escape(part[1:-1]) + '</code>')
        elif part.startswith('**') and part.endswith('**'):
            parts.append('<strong>' + inline(part[2:-2]) + '</strong>')
        elif re.fullmatch(r'\[[^\]]+\]\([^)]+\)', part):
            label, href = re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)', part).groups()
            if href.startswith(('javascript:', 'data:')):
                raise ValueError('Unexpected link scheme')
            parts.append(f'<a href="{html.escape(href, quote=True)}">{inline(label)}</a>')
        else:
            parts.append(html.escape(part))
    return ''.join(parts)


def render(markdown):
    lines = markdown.splitlines()
    output = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('```'):
            language = line[3:].strip()
            block = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                block.append(lines[i]); i += 1
            if i == len(lines):
                raise ValueError('Unclosed code fence')
            output.append('<div class="code-wrap"><span class="code-label">' + html.escape(language or '示意') + '</span><pre><code>' + html.escape('\n'.join(block)) + '</code></pre></div>')
            i += 1
            continue
        match = re.match(r'^(#{1,3}) (.+)$', line)
        if match:
            level, title = len(match[1]), match[2]
            key = f'section-{len(headings) + 1}'
            if level == 2:
                key = 'chapter-' + title[:2]
            if level == 3 and re.match(r'Q\d+', title):
                key = re.match(r'Q\d+', title)[0].lower()
            headings.append({'level': level, 'title': title, 'id': key})
            output.append(f'<h{level} id="{key}">{inline(title)}</h{level}>')
            i += 1
            continue
        if line.startswith('|') and i + 1 < len(lines) and re.fullmatch(r'[|\s:\-]+', lines[i + 1]):
            rows = []
            rows.append([cell.strip() for cell in line.strip().strip('|').split('|')])
            i += 2
            while i < len(lines) and lines[i].startswith('|'):
                rows.append([cell.strip() for cell in lines[i].strip().strip('|').split('|')]); i += 1
            width = len(rows[0])
            if any(len(row) != width for row in rows):
                raise ValueError('Inconsistent table columns')
            table = '<div class="table-wrap" tabindex="0"><table><thead><tr>' + ''.join('<th scope="col">' + inline(cell) + '</th>' for cell in rows[0]) + '</tr></thead><tbody>'
            table += ''.join('<tr>' + ''.join('<td>' + inline(cell) + '</td>' for cell in row) + '</tr>' for row in rows[1:])
            output.append(table + '</tbody></table></div>')
            continue
        list_match = re.match(r'^(?:([-]) |(\d+)\. )(.+)$', line)
        if list_match:
            ordered = bool(list_match[2])
            tag = 'ol' if ordered else 'ul'
            items = []
            while i < len(lines):
                m = re.match(r'^(?:([-]) |(\d+)\. )(.+)$', lines[i])
                if not m or bool(m[2]) != ordered:
                    break
                items.append('<li>' + inline(m[3]) + '</li>'); i += 1
            output.append(f'<{tag}>' + ''.join(items) + f'</{tag}>')
            continue
        para = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(?:#{1,3} |```|\||- |\d+\. )', lines[i]):
            para.append(lines[i]); i += 1
        output.append('<p>' + inline(' '.join(para)) + '</p>')
    return '\n'.join(output)


body = render(text)
nav = []
opened = False
for heading in headings:
    if heading['level'] == 1:
        continue
    title, key = html.escape(heading['title']), heading['id']
    if heading['level'] == 2:
        if opened:
            nav.append('</div></details>')
        nav.append(f'<details><summary><a href="#{key}">{title}</a></summary><div class="subnav">')
        opened = True
    else:
        nav.append(f'<a href="#{key}">{title}</a>')
if opened:
    nav.append('</div></details>')

CSS = r'''
:root{--ink:#243345;--muted:#637386;--accent:#176559;--line:#dfe7e7;--paper:#fff;--soft:#f3f7f6;--side:330px;color-scheme:light}
*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;color:var(--ink);background:var(--paper);font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.9;overflow-wrap:anywhere}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
aside{position:fixed;inset:0 auto 0 0;width:var(--side);background:var(--soft);border-right:1px solid var(--line);display:flex;flex-direction:column;z-index:5}.brand{padding:22px 19px 15px;border-bottom:1px solid var(--line)}.brand strong{display:block;font-size:22px;letter-spacing:.03em}.brand small{display:block;color:var(--muted);font-size:12px;margin:3px 0 15px}.searchbox{display:flex;gap:5px}input{width:100%;min-width:0;border:1px solid #cbd9d5;border-radius:7px;padding:10px;font:inherit;font-size:14px;background:white}button{cursor:pointer;background:white;color:var(--accent);border:1px solid var(--line);padding:7px 10px;border-radius:6px;font:inherit;font-size:13px}.tools{display:flex;gap:8px;margin-top:10px}.tools button{background:transparent;padding:4px 7px}.navscroll{overflow-y:auto;flex:1;padding:12px 12px 32px;scrollbar-width:thin}nav summary{padding:8px 3px;font-size:14px;font-weight:bold;cursor:pointer}nav summary a{color:var(--ink)}.subnav{border-left:1px solid #ccdcd7;margin:0 0 10px 9px;padding-left:8px}.subnav a{display:block;padding:5px;font-size:12px;line-height:1.7;color:#4b606d}.subnav a:hover{background:#e4eeeb;text-decoration:none}#results{display:none}#results a{display:block;padding:11px 8px;border-bottom:1px solid var(--line)}#results span{display:block;font-size:12px;color:var(--muted);line-height:1.7}.search-status{font-size:12px;color:var(--muted);margin:8px 0 0}
main{margin-left:var(--side);max-width:1450px;padding:36px 54px 100px}.eyebrow{font-size:12px;letter-spacing:.15em;color:var(--accent);font-weight:700}.edition{color:var(--muted);font-size:13px;padding:14px 18px;background:var(--soft);border:1px solid var(--line);border-radius:9px;margin:18px 0 30px}h1{font-size:32px;line-height:1.55;margin:12px 0 24px;letter-spacing:-.02em}h2{font-size:27px;line-height:1.6;margin:58px 0 24px;padding:25px 0 0;border-top:2px solid var(--line);color:#153c38}h3{font-size:20px;line-height:1.6;margin:32px 0 15px}h1,h2,h3{scroll-margin-top:20px}p{margin:12px 0 19px}li{margin:8px 0}strong{font-weight:650}code{font-family:Consolas,"Cascadia Code",monospace;font-size:.88em;background:#f0f4f6;border-radius:4px;padding:2px 4px}.code-wrap{border:1px solid var(--line);background:#f7f9fa;border-radius:8px;margin:22px 0;overflow:hidden}.code-label{display:block;padding:7px 16px;border-bottom:1px solid var(--line);font-size:11px;line-height:1.4;color:var(--muted)}pre{overflow-x:auto;margin:0;padding:17px;line-height:1.7;tab-size:4}pre code{padding:0;background:none;font-size:13px;white-space:pre;overflow-wrap:normal}.table-wrap{overflow-x:auto;margin:22px 0;border:1px solid var(--line);border-radius:7px}table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.8}th,td{padding:11px 13px;vertical-align:top;text-align:left;border-right:1px solid var(--line);border-bottom:1px solid var(--line);min-width:110px}th{background:#eaf2ef;color:#244a43}tr:last-child td{border-bottom:0}th:last-child,td:last-child{border-right:0}tbody tr:nth-child(even){background:#fbfcfc}.menu{display:none}footer{color:var(--muted);border-top:1px solid var(--line);padding-top:20px;font-size:12px;margin-top:50px}.progress{position:fixed;top:0;left:var(--side);right:0;height:3px;background:transparent;z-index:7}.progress i{display:block;background:var(--accent);height:100%;width:0}
@media(min-width:1700px){main{padding-left:80px;padding-right:80px}}@media(max-width:900px){:root{--side:305px}aside{transform:translateX(-100%)}body.menu-open aside{transform:translateX(0);box-shadow:12px 0 35px #0002}.menu{display:block;position:fixed;top:12px;right:12px;z-index:8;background:#fff}.progress{left:0}main{margin-left:0;padding:65px 20px 75px}h1{font-size:26px}h2{font-size:23px}h3{font-size:19px}th,td{min-width:140px;padding:9px}}
@media print{aside,.menu,.progress,.edition{display:none}main{margin:0;padding:0;max-width:none}h2{break-before:page}h2,h3{break-after:avoid}body{font-size:10.5pt}a{color:inherit}table{font-size:9pt}.table-wrap{overflow:visible}pre{white-space:pre-wrap}pre code{white-space:pre-wrap;overflow-wrap:anywhere}.code-wrap{break-inside:avoid}th,td{min-width:0}footer{display:none}}
'''
JS = r'''
const nav=document.querySelector('nav'),results=document.querySelector('#results'),input=document.querySelector('#search'),status=document.querySelector('#status');
const blocks=[...document.querySelectorAll('article h2,article h3')].map(h=>{let text='';for(let n=h.nextElementSibling;n&&!/^H[23]$/.test(n.tagName);n=n.nextElementSibling)text+=' '+n.textContent;return{id:h.id,title:h.textContent,text};});
function search(){const q=input.value.trim().toLowerCase();results.replaceChildren();nav.style.display=q?'none':'';results.style.display=q?'block':'none';if(!q){status.textContent='26 章 · 100 个分级问答';return;}const words=q.split(/\s+/);const hits=blocks.filter(b=>words.every(w=>(b.title+' '+b.text).toLowerCase().includes(w)));status.textContent=`找到 ${hits.length} 个段落`;for(const b of hits.slice(0,100)){const a=document.createElement('a');a.href='#'+b.id;a.textContent=b.title;const s=document.createElement('span');const pos=b.text.toLowerCase().indexOf(words[0]);const begin=Math.max(0,pos-20);s.textContent=(begin?'…':'')+b.text.slice(begin,begin+110)+'…';a.append(s);results.append(a);}}
input.addEventListener('input',search);document.querySelector('#clear').addEventListener('click',()=>{input.value='';search();input.focus();});document.querySelector('#menu').addEventListener('click',()=>document.body.classList.toggle('menu-open'));
document.querySelector('#collapse').addEventListener('click',()=>nav.querySelectorAll('details').forEach(d=>d.open=false));document.querySelector('#expand').addEventListener('click',()=>nav.querySelectorAll('details').forEach(d=>d.open=true));document.querySelector('#print').addEventListener('click',()=>window.print());
document.querySelector('aside').addEventListener('click',e=>{if(e.target.closest('a[href^="#"]'))document.body.classList.remove('menu-open');});
window.addEventListener('scroll',()=>{const d=document.documentElement;document.querySelector('.progress i').style.width=(100*d.scrollTop/Math.max(1,d.scrollHeight-d.clientHeight))+'%';},{passive:true});
search();
'''
digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
han = len(re.findall(r'[\u4e00-\u9fff]', text))
page = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'">
<title>拾味项目全解 · 架构、落地与面试答辩</title><style>{CSS}</style></head><body>
<div class="progress" aria-hidden="true"><i></i></div><button id="menu" class="menu" aria-label="打开或关闭目录">目录 / 搜索</button>
<aside aria-label="文档导航"><div class="brand"><strong>拾味 · 项目全解</strong><small>2026.10.30 事实快照 · 离线阅读版</small><div class="searchbox"><input id="search" type="search" aria-label="搜索全文段落" placeholder="搜问题、技术、关键词…"><button id="clear" aria-label="清空搜索">清空</button></div><div id="status" class="search-status" aria-live="polite"></div><div class="tools"><button id="expand">展开目录</button><button id="collapse">收起</button><button id="print">打印</button></div></div><div class="navscroll"><nav>{''.join(nav)}</nav><div id="results"></div></div></aside>
<main><div class="eyebrow">真实问题 → 架构 → 实现 → 验证 → 答辩</div><div class="edition">26 章 · 100 个分级问答 · 约 {han/10000:.1f} 万汉字<br>当前代码与发布事实、研究样例、待实施方案分别说明。可直接离线阅读；正文不加载任何外部资源。源文档：<a href="{SOURCE.name}">Markdown</a></div><article>{body}</article><footer>根据本地源文档生成。内容 SHA-256：{digest}<br>资料链接由你点击时打开；阅读本页不调用模型、不访问线上项目。</footer></main><script>{JS}</script></body></html>'''
TARGET.write_text(page, encoding='utf-8')
question_ids = re.findall(r'^### Q(\d+)', text, re.M)
assert [int(q) for q in question_ids] == list(range(1, 101))
assert sum(h['level'] == 2 for h in headings) == 26
assert len({h['id'] for h in headings}) == len(headings)
missing = []
for label, href in re.findall(r'\[([^\]]+)\]\(([^)]+)\)', text):
    if '://' not in href and not href.startswith('#') and not (ROOT / href.split('#')[0]).exists():
        missing.append(href)
assert not missing, missing
audit = {'source': SOURCE.name, 'reader': TARGET.name, 'sourceSha256': digest,
         'characters': len(text), 'hanCharacters': han, 'chapters': 26, 'questions': 100,
         'headings': len(headings), 'missingLocalLinks': missing,
         'externalResourcesLoaded': False, 'projectTestsRun': False, 'deployments': 0,
         'realModelCalls': 0}
(ROOT / 'document-check.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(audit, ensure_ascii=True))
