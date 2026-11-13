"""Build the offline handbook from its Markdown sources; Python stdlib only.

This renders the limited Markdown features used by these trusted local documents.
It is not a general Markdown engine and does not execute raw HTML or scripts.
"""
from pathlib import Path
import base64
import hashlib
import html
import json
import re
from urllib.parse import unquote, urlsplit

HERE = Path(__file__).resolve().parent
DOCS = [
    ("intro", "开始阅读", "README.md"),
    ("refresh", "当前增量：知识v3 / 映射", "../evidence-refresh-2026-11-12.md"),
    ("evaluation-loop", "当前增量：开放评测 / 人工反馈", "../output-evaluation-2026-11-13.md"),
    ("story", "项目与真实链路", "project-story.md"),
    ("business", "001–015 业务 / 数据 / 切块", "qa-01-business-data.md"),
    ("retrieval", "016–035 检索 / 增强 / 生成", "qa-02-retrieval-generation.md"),
    ("agent", "036–057 Agent / 评测", "qa-03-agent-evaluation.md"),
    ("engineering", "058–084 模型 / 协议 / 工程", "qa-04-engineering-extensions.md"),
    ("scenarios", "085–112 上下文 / 异常", "qa-05-foundations-scenarios.md"),
    ("experiments", "实验与选型账本", "experiments-and-decisions.md"),
    ("failures", "真实问题与亮点", "failures-and-highlights.md"),
    ("foundations", "理论与亲手练习", "foundations-and-exercises.md"),
    ("sources", "来源与逐题覆盖", "sources-and-coverage.md"),
    ("parameters", "附录：全部参数实测", "../rag-parameters-and-chunking.md"),
]
INCLUDED = {(HERE / file).resolve(): key for key, _, file in DOCS}


def link_url(raw, source):
    parts = urlsplit(raw)
    if parts.scheme in ("https", "http"):
        return raw
    if parts.scheme or raw.startswith("//"):
        return "#intro"
    if not parts.path:
        return "#" + parts.fragment
    path = (source.parent / unquote(parts.path)).resolve()
    if path == HERE / "reader.html":
        return "#intro"
    if path in INCLUDED:
        return "#" + (parts.fragment or INCLUDED[path])
    # Preserve paths relative to reader.html, including project code references.
    import os
    result = Path(os.path.relpath(path, HERE)).as_posix()
    return result + ("#" + parts.fragment if parts.fragment else "")


def inline(text, source):
    tokens = []

    def save(value):
        tokens.append(value)
        return f"\x00{len(tokens)-1}\x00"

    def image(match):
        path = (source.parent / unquote(match[2])).resolve()
        if path != HERE / "architecture.svg":
            return save(html.escape(match[0]))
        content = base64.b64encode(path.read_bytes()).decode()
        return save(f'<img class="architecture" alt="{html.escape(match[1], quote=True)}" '
                    f'src="data:image/svg+xml;base64,{content}">')

    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', image, text)
    text = re.sub(r'`([^`]+)`', lambda m: save('<code>'+html.escape(m[1])+'</code>'), text)

    def link(match):
        href = link_url(match[2], source)
        extra = ' target="_blank" rel="noopener noreferrer"' if href.startswith(('https://', 'http://')) else ''
        label = html.escape(match[1])
        label = re.sub(r'\x00(\d+)\x00', lambda m: tokens[int(m[1])], label)
        return save(f'<a href="{html.escape(href, quote=True)}"{extra}>{label}</a>')

    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)
    text = html.escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'\x00(\d+)\x00', lambda m: tokens[int(m[1])], text)


def render_md(text, source, scope):
    lines = text.splitlines()
    out, i, heading = [], 0, 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('```'):
            lang = line[3:].strip()
            block = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                block.append(lines[i]); i += 1
            if i == len(lines):
                raise ValueError(f'Unclosed fence in {source.name}')
            out.append(f'<pre aria-label="{html.escape(lang or "文本", quote=True)}"><code>'
                       +html.escape('\n'.join(block))+'</code></pre>')
            i += 1
            continue
        anchor = re.fullmatch(r'<a id="([\w-]+)"></a>', line)
        if anchor:
            out.append(f'<span id="{anchor[1]}" class="anchor"></span>')
            i += 1
            continue
        title = re.match(r'^(#{1,6})\s+(.+)', line)
        if title:
            heading += 1
            level = min(6, len(title[1])+1)
            out.append(f'<h{level} id="{scope}-h{heading}">{inline(title[2], source)}</h{level}>')
            i += 1
            continue
        if line.startswith('|') and i+1<len(lines) and re.match(r'^\|\s*:?-+', lines[i+1]):
            def cells(row):
                return re.split(r'(?<!\\)\|', row.strip().strip('|'))
            head = cells(line)
            out.append('<div class="table-wrap" tabindex="0"><table><thead><tr>'
                       +''.join('<th>'+inline(x.strip(), source)+'</th>' for x in head)
                       +'</tr></thead><tbody>')
            i += 2
            while i < len(lines) and lines[i].startswith('|'):
                row=cells(lines[i])
                if len(row)!=len(head):
                    raise ValueError(f'Table columns differ in {source.name}: {lines[i]}')
                out.append('<tr>'+''.join('<td>'+inline(x.strip().replace('\\|','|'), source)+'</td>' for x in row)+'</tr>')
                i += 1
            out.append('</tbody></table></div>')
            continue
        item = re.match(r'^(?:- |\d+\. )(.+)', line)
        if item:
            ordered = not line.startswith('- ')
            tag='ol' if ordered else 'ul'
            pattern=r'^\d+\. (.+)' if ordered else r'^- (.+)'
            out.append('<'+tag+'>')
            while i<len(lines):
                found=re.match(pattern, lines[i])
                if not found:
                    break
                out.append('<li>'+inline(found[1], source)+'</li>')
                i+=1
                # Blank lines between list entries belong to the same list.
                if i+1<len(lines) and not lines[i].strip() and re.match(pattern,lines[i+1]):
                    i+=1
            out.append('</'+tag+'>')
            continue
        block=[line]; i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(#|\||```|<a id=|- |\d+\. )',lines[i]):
            block.append(lines[i]); i+=1
        out.append('<p>'+inline(' '.join(block), source)+'</p>')
    return '\n'.join(out)


CSS = '''
:root{--ink:#1e3448;--muted:#506779;--paper:#fff;--bg:#eef3f6;--line:#d6e1e8;--accent:#0d6c59;color-scheme:light}
*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;font:16px/1.8 "Segoe UI","Microsoft YaHei",sans-serif;color:var(--ink);background:var(--bg)}
a{color:#066b8d;text-underline-offset:3px;overflow-wrap:anywhere}a:hover{color:#0b4b3e}button,input{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #e8b43d;outline-offset:3px}
.sidebar{position:fixed;inset:0 auto 0 0;width:280px;padding:25px 18px;background:#142f3f;color:#f4f8fb;overflow-y:auto}.brand{font-size:22px;font-weight:700;margin:0}.sub{font-size:13px;color:#b5cbd8;margin:5px 0 22px}.sidebar nav{display:grid;gap:4px}.sidebar a{color:#dbe8ee;padding:9px 12px;border-radius:7px;text-decoration:none;font-size:14px}.sidebar a[aria-current=page],.sidebar a:hover{background:#244c5c;color:#fff}.scope{font-size:12px;line-height:1.8;color:#b5cbd8;padding:18px 12px}.main{margin-left:280px;padding:32px clamp(20px,4vw,70px) 70px;min-width:0}.wrap{max-width:1120px;margin:auto}
header{margin-bottom:24px}.eyebrow{font-size:13px;color:var(--accent);font-weight:700;letter-spacing:1px}h1{font-size:clamp(25px,3vw,38px);line-height:1.4;margin:9px 0 10px}header p{margin:6px 0;color:var(--muted);font-size:14px}.pills{display:flex;gap:9px;flex-wrap:wrap;margin:16px 0}.pill{background:#dcece6;color:#145848;border-radius:30px;padding:4px 12px;font-size:13px}
.tools{position:sticky;top:0;z-index:2;padding:12px 0;background:var(--bg);display:flex;gap:8px;flex-wrap:wrap}.search-box{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid #bcced8;border-radius:8px;flex:1;min-width:180px;padding:7px 12px}.search-box input{border:0;outline:0;width:100%;min-width:0;font-size:15px;background:transparent;color:var(--ink)}.tools button{background:#fff;color:var(--ink);border:1px solid #bcced8;border-radius:8px;padding:6px 12px;font-size:14px}.tools button:hover{background:#dcece6}.result{font-size:13px;color:var(--muted);margin:8px 0 16px;min-height:24px}
.chapter{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:clamp(18px,3vw,38px);margin-bottom:22px;min-width:0}.chapter[hidden],details[hidden]{display:none!important}h2{font-size:25px;line-height:1.5;margin:0 0 18px}h3{font-size:21px;margin:30px 0 12px;line-height:1.5}h4{font-size:18px;margin:24px 0 9px;line-height:1.6}p{margin:12px 0}li{margin:9px 0}ul,ol{padding-left:24px}code{font:0.9em/1.6 Consolas,monospace;background:#eef3f6;padding:1px 4px;border-radius:3px;overflow-wrap:anywhere}pre{padding:18px;background:#172f40;color:#e6f1f6;border-radius:8px;overflow:auto;font-size:13px;line-height:1.65}pre code{background:none;padding:0;color:inherit;overflow-wrap:normal}.table-wrap{overflow-x:auto;max-width:100%;margin:20px 0;border:1px solid var(--line);border-radius:7px}table{border-collapse:collapse;min-width:650px;width:100%;font-size:14px;line-height:1.7}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:11px 13px;overflow-wrap:anywhere}th{background:#eaf2ef;color:#214c41}tr:last-child td{border-bottom:0}td:first-child{min-width:85px}img.architecture{width:100%;height:auto;display:block;margin:20px 0}
details.card{border:1px solid var(--line);border-radius:8px;margin:15px 0;background:#fff;scroll-margin-top:110px}details.card[open]{border-left:4px solid var(--accent)}summary{padding:15px 18px;font-weight:650;cursor:pointer;font-size:17px;line-height:1.6}summary:hover{background:#f1f7f4;border-radius:8px}.card-body{padding:0 20px 17px}.card-body p{font-size:14px;color:var(--muted)}.card-body li{font-size:15px;margin:13px 0}.anchor{scroll-margin-top:100px}footer{font-size:12px;color:var(--muted);margin-top:25px}.empty{padding:30px;background:#fff;border:1px dashed #94aebc;border-radius:10px}.menu{display:none}.chapter:target{outline:2px solid #94b9aa}
@media(max-width:950px){.sidebar{width:235px}.main{margin-left:235px;padding:24px 20px 50px}.sidebar a{font-size:13px;padding:8px}h2{font-size:23px}}
@media(max-width:700px){.sidebar{position:static;width:100%;padding:14px 18px}.sidebar nav{display:none;margin-top:12px}.sidebar.open nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.brand{font-size:20px}.sub{margin:2px 0 0}.scope{display:none}.menu{display:block;position:absolute;right:16px;top:17px;border:1px solid #6c91a4;background:#244c5c;color:#fff;border-radius:6px;padding:3px 10px}.main{margin:0;padding:20px 12px 45px}.chapter{padding:18px 15px}header p{font-size:13px}.tools{padding:8px 0}.tools button{padding:6px 9px;font-size:13px}h2{font-size:22px}h3{font-size:20px}h4{font-size:17px}.card-body{padding:0 13px 12px}summary{padding:13px;font-size:16px}table{min-width:640px}.pills{gap:6px}.pill{font-size:12px;padding:3px 9px}}
@media print{.sidebar,.tools,.result,.menu,header,.source-return{display:none!important}.main{margin:0;padding:0}.chapter{border:0;padding:0;break-before:page}.chapter[hidden]{display:block!important}details[hidden]{display:block!important}details{break-inside:avoid}.card-body{display:block!important}.table-wrap{overflow:visible}table{min-width:0;font-size:10px}a{color:#000}pre{white-space:pre-wrap;color:#000;background:#eee}}
'''

JS = '''
const chapters=[...document.querySelectorAll('.chapter')];
const cards=[...document.querySelectorAll('details.card')];
const search=document.getElementById('search');
const status=document.getElementById('result');
let selected='intro';
function select(id,move=true){
 const target=document.getElementById(id)||document.getElementById('intro');
 const chapter=target.closest('.chapter');if(!chapter)return;
 selected=chapter.id;search.value='';
 chapters.forEach(s=>s.hidden=s!==chapter);cards.forEach(c=>c.hidden=false);
 document.querySelectorAll('.sidebar nav a').forEach(a=>a.setAttribute('aria-current',a.hash==='#'+selected?'page':'false'));
 const card=target.closest('details');if(card)card.open=true;
 status.textContent='当前章节 · '+chapter.dataset.label+'；问答共112题';
 if(move)requestAnimationFrame(()=>{if(target===chapter)window.scrollTo(0,0);else target.scrollIntoView({block:'start'});});
}
function filter(){
 const terms=search.value.toLocaleLowerCase().trim().split(/\\s+/).filter(Boolean);
 if(!terms.length){document.getElementById('empty').hidden=true;select(selected,false);return;}
 let count=0,sections=0;
 for(const chapter of chapters){
  const entries=[...chapter.querySelectorAll('details.card')];
  if(entries.length){for(const card of entries){const text=card.textContent.toLocaleLowerCase();card.hidden=!terms.every(t=>text.includes(t));if(!card.hidden){card.open=true;count++;}}chapter.hidden=entries.every(c=>c.hidden);}
  else{const text=chapter.textContent.toLocaleLowerCase();chapter.hidden=!terms.every(t=>text.includes(t));}
  if(!chapter.hidden)sections++;
 }
 status.textContent='匹配 '+count+' 道问答、'+sections+' 个章节（正文、参数及来源同时搜索）';
 document.getElementById('empty').hidden=sections!==0;
}
search.addEventListener('input',filter);
document.getElementById('clear').addEventListener('click',()=>{search.value='';document.getElementById('empty').hidden=true;select(selected,false);search.focus();});
document.getElementById('expand').addEventListener('click',()=>cards.filter(c=>!c.hidden&&!c.closest('.chapter').hidden).forEach(c=>c.open=true));
document.getElementById('collapse').addEventListener('click',()=>cards.forEach(c=>c.open=false));
document.querySelector('.menu').addEventListener('click',()=>{const panel=document.querySelector('.sidebar');panel.classList.toggle('open');document.querySelector('.menu').setAttribute('aria-expanded',panel.classList.contains('open'));});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();search.focus();}if(e.key==='Escape'){search.value='';document.getElementById('empty').hidden=true;select(selected,false);}});
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;const id=decodeURIComponent(a.hash.slice(1));if(!document.getElementById(id))return;e.preventDefault();document.getElementById('empty').hidden=true;history.replaceState(null,'','#'+id);select(id);document.querySelector('.sidebar').classList.remove('open');document.querySelector('.menu').setAttribute('aria-expanded','false');});
window.addEventListener('hashchange',()=>select(decodeURIComponent(location.hash.slice(1))||'intro'));
select(decodeURIComponent(location.hash.slice(1))||'intro',false);
'''


def build():
    sections, source_hashes = [], []
    for key, label, file in DOCS:
        path = (HERE/file).resolve()
        text = path.read_text('utf-8-sig')
        source_hashes.append((file, hashlib.sha256(path.read_bytes()).hexdigest()))
        segments = re.split(r'(?=<a id="q\d{3}"></a>)', text)
        body = render_md(segments[0], path, key)
        for segment in segments[1:]:
            match=re.match(r'<a id="(q\d{3})"></a>\n### (.+?)\n',segment)
            if not match:
                raise ValueError('Invalid question block')
            rest=segment[match.end():]
            body+=f'<details class="card" id="{match[1]}"><summary>{inline(match[2],path)}</summary><div class="card-body">'+render_md(rest,path,match[1])+'</div></details>'
        sections.append(f'<section class="chapter" id="{key}" data-label="{html.escape(label,quote=True)}" hidden>'+body+'</section>')
    nav=''.join(f'<a href="#{key}">{html.escape(label)}</a>' for key,label,_ in DOCS)
    digest=base64.b64encode(hashlib.sha256(JS.encode()).digest()).decode()
    content='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'''
    content+=f'''<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'sha256-{digest}'; base-uri 'none'; form-action 'none'"><title>拾味 · AI / Agent / RAG 工程与面试手册</title><style>{CSS}</style></head><body>'''
    content+=f'''<aside class="sidebar"><p class="brand">拾味 · AI工程手册</p><p class="sub">从真实代码讲到面试追问</p><button class="menu" aria-expanded="false" aria-label="展开章节目录">目录</button><nav aria-label="章节">{nav}</nav><p class="scope">基线 bfa1567 · 2026-11-12<br>已实现 / 本地研究 / 候选 / 方案<br>独立评测与重排仍有缺口<br>无需联网，不调用模型</p></aside>'''
    content+='''<main class="main"><div class="wrap"><header><div class="eyebrow">项目事实 · 选择理由 · 参数 · 实验 · 失败复盘</div><h1>把每一步讲明白，也讲清依据</h1><p>围绕菜谱推荐：从资料与向量存储，到检索增强、生成、约束、评测及工程边界。</p><div class="pills"><span class="pill">112张问答卡</span><span class="pill">全部参数实测附录</span><span class="pill">真实链路与失败记录</span><span class="pill">逐题来源覆盖</span></div></header><div class="tools"><label class="search-box"><span aria-hidden="true">⌕</span><input id="search" type="search" aria-label="搜索全部手册" placeholder="搜索 RRF / 切块 / 512 / Q112 …（按 / 聚焦）"></label><button id="clear">清空</button><button id="expand">展开本页问答</button><button id="collapse">折叠问答</button></div><p class="result" id="result" role="status" aria-live="polite"></p><div class="empty" id="empty" hidden>没有匹配内容。可尝试简称或题号。</div>'''
    content+=''.join(sections)
    content+='''<footer>Markdown为正文来源；render.py离线生成。外部面经用于发现问题，不能当作官方面试证明。实际状态以当前代码与验收为准。</footer></div></main>'''
    content+='<script>'+JS+'</script></body></html>\n'
    (HERE/'reader.html').write_text(content,'utf-8',newline='\n')
    print(json.dumps({'readerBytes':len(content.encode()),'questions':len(re.findall(r'<details class="card"',content)),
                      'sections':len(sections),'sourceHashes':dict(source_hashes)},ensure_ascii=False))


if __name__=='__main__':
    build()
