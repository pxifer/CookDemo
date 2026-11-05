from pathlib import Path
from copy import deepcopy
import re, json, hashlib
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT = Path(__file__).resolve().parent.parent
BLACK = '000000'

def font_style(style, size, bold=False, east='宋体', latin='Aptos'):
    style.font.name=latin
    style.font.size=Pt(size)
    style.font.bold=bold
    style.font.italic=False
    style.font.color.rgb=RGBColor.from_string(BLACK)
    rpr=style.element.get_or_add_rPr()
    rf=rpr.find(qn('w:rFonts'))
    if rf is None:
        rf=OxmlElement('w:rFonts');rpr.insert(0,rf)
    for k,v in [('ascii',latin),('hAnsi',latin),('eastAsia',east)]:rf.set(qn('w:'+k),v)
    for c in rpr.findall(qn('w:color')):
        for key in ['themeColor','themeTint','themeShade']:
            c.attrib.pop(qn('w:'+key),None)

def run_text(p,text,bold=False,code=False):
    r=p.add_run(text);r.bold=bold
    if code:
        r.font.name='Consolas';r.font.size=Pt(9)
        rf=r._element.get_or_add_rPr().get_or_add_rFonts();rf.set(qn('w:eastAsia'),'宋体')
    return r

TOKEN=re.compile(r'\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`')
def inline(p,text):
    cursor=0
    for m in TOKEN.finditer(text):
        if m.start()>cursor:run_text(p,text[cursor:m.start()])
        if m.group(1):
            label,url=m.group(1),m.group(2)
            h=OxmlElement('w:hyperlink')
            if url.startswith('#'):h.set(qn('w:anchor'),url[1:])
            else:h.set(qn('r:id'),p.part.relate_to(url,RT.HYPERLINK,is_external=True))
            rr=OxmlElement('w:r');rp=OxmlElement('w:rPr')
            col=OxmlElement('w:color');col.set(qn('w:val'),'244A68');rp.append(col)
            fonts=OxmlElement('w:rFonts');fonts.set(qn('w:eastAsia'),'宋体');fonts.set(qn('w:ascii'),'Aptos');rp.append(fonts)
            rr.append(rp);t=OxmlElement('w:t');t.text=label;rr.append(t);h.append(rr);p._p.append(h)
        elif m.group(3):run_text(p,m.group(3),bold=True)
        else:run_text(p,m.group(4),code=True)
        cursor=m.end()
    if cursor<len(text):run_text(p,text[cursor:])

def bookmark(p,name,num):
    a=OxmlElement('w:bookmarkStart');a.set(qn('w:id'),str(num));a.set(qn('w:name'),name)
    b=OxmlElement('w:bookmarkEnd');b.set(qn('w:id'),str(num));p._p.insert(0,a);p._p.append(b)

def table(doc,rows):
    cols=len(rows[0]);t=doc.add_table(rows=1,cols=cols)
    t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    # Narrow identifiers and short status fields; narrative receives more room.
    if cols==2: ratios=[0.28,0.72]
    elif cols==3:ratios=[0.23,0.41,0.36]
    elif cols==4:ratios=[0.17,0.29,0.31,0.23]
    else:ratios=[1/cols]*cols
    width=17.0
    for c,r in zip(t.columns,ratios):c.width=Cm(width*r)
    for rid,row in enumerate(rows):
        cells=t.rows[0].cells if rid==0 else t.add_row().cells
        trpr=t.rows[rid]._tr.get_or_add_trPr()
        cant=OxmlElement('w:cantSplit');trpr.append(cant)
        if rid==0:
            repeat=OxmlElement('w:tblHeader');trpr.append(repeat)
        for j,c in enumerate(cells):
            c.width=Cm(width*ratios[j]);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcpr=c._tc.get_or_add_tcPr()
            shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'DEEAF3' if rid==0 else ('F5F7F9' if rid%2==0 else 'FFFFFF'));tcpr.append(shade)
            margins=OxmlElement('w:tcMar')
            for side,val in [('top',75),('bottom',75),('left',85),('right',85)]:
                e=OxmlElement('w:'+side);e.set(qn('w:w'),str(val));e.set(qn('w:type'),'dxa');margins.append(e)
            tcpr.append(margins)
            borders=OxmlElement('w:tcBorders')
            for side in ['top','left','bottom','right']:
                e=OxmlElement('w:'+side);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
            tcpr.append(borders)
            p=c.paragraphs[0];p.style='Table Body';p.paragraph_format.keep_with_next=False
            value=row[j] if j<len(row) else ''
            inline(p,value)
            if rid==0:
                for r in p.runs:r.bold=True
            if j==0 and len(value)<12:p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph().paragraph_format.space_after=Pt(2)
    return t

def build(path):
    lines=path.read_text(encoding='utf-8').splitlines();doc=Document()
    sec=doc.sections[0];sec.page_width=Cm(21);sec.page_height=Cm(29.7)
    sec.top_margin=Cm(1.9);sec.bottom_margin=Cm(1.8);sec.left_margin=Cm(2);sec.right_margin=Cm(2)
    sec.footer_distance=Cm(.8)
    styles=doc.styles
    # The bundled python-docx template contains blue paragraph borders.
    # Strip inherited title/heading rules before authoring.
    for border in list(styles.element.iter(qn('w:pBdr'))):
        border.getparent().remove(border)
    font_style(styles['Normal'],10.5)
    normal=styles['Normal'].paragraph_format;normal.line_spacing=1.14;normal.space_after=Pt(5)
    normal.widow_control=True
    font_style(styles['Title'],22,True,east='黑体');styles['Title'].paragraph_format.space_after=Pt(10)
    for name,size in [('Heading 1',15),('Heading 2',11.5),('Heading 3',11)]:
        font_style(styles[name],size,True,east='黑体')
        pf=styles[name].paragraph_format;pf.space_before=Pt(12);pf.space_after=Pt(5);pf.keep_with_next=True
    for name,size in [('Subtitle',11),('Caption',9)]:font_style(styles[name],size)
    for name in ['Table Body','Code Text','Navigation']:
        if name not in styles:styles.add_style(name,1)
    font_style(styles['Table Body'],9)
    pf=styles['Table Body'].paragraph_format;pf.space_after=Pt(1);pf.line_spacing=1.08
    font_style(styles['Code Text'],8.5,east='宋体',latin='Consolas')
    pf=styles['Code Text'].paragraph_format;pf.space_after=Pt(0);pf.line_spacing=1.02;pf.left_indent=Cm(.2)
    font_style(styles['Navigation'],9.5);styles['Navigation'].paragraph_format.space_after=Pt(2)
    f=sec.footer.paragraphs[0];f.alignment=WD_ALIGN_PARAGRAPH.CENTER
    r=f.add_run();r.font.size=Pt(9)
    fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');r._r.addnext(fld)
    doc.core_properties.title=lines[0].lstrip('# ');doc.core_properties.subject='Agent开发面试与拾味项目实施'
    doc.core_properties.author='';doc.core_properties.keywords='Agent RAG 面试 拾味'
    headings=[(i,line[3:],f'section_{i}') for i,line in enumerate(lines) if line.startswith('## ')]
    toc_done=False;i=0;count=1
    while i<len(lines):
        line=lines[i].strip()
        if not line:i+=1;continue
        if line.startswith('## ') and not toc_done:
            p=doc.add_paragraph('阅读导航','Heading 1')
            for n,label,anchor in headings:
                p=doc.add_paragraph(style='Navigation');inline(p,f'[{label}](#{anchor})')
            toc_done=True
        if line.startswith('# '):doc.add_paragraph(line[2:],'Title');i+=1;continue
        if line.startswith('## '):
            p=doc.add_paragraph(line[3:],'Heading 1');bookmark(p,f'section_{i}',count);count+=1;i+=1;continue
        if line.startswith('### '):doc.add_paragraph(line[4:],'Heading 2');i+=1;continue
        if line.startswith('```'):
            i+=1
            while i<len(lines) and not lines[i].startswith('```'):
                p=doc.add_paragraph(lines[i],'Code Text');p.paragraph_format.keep_with_next=False
                i+=1
            i+=1;doc.add_paragraph().paragraph_format.space_after=Pt(1);continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                row=[x.strip() for x in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?',x.replace(' ','')) for x in row):rows.append(row)
                i+=1
            table(doc,rows);continue
        if re.match(r'^\d+\. ',line):
            p=doc.add_paragraph();p.paragraph_format.left_indent=Cm(.3);p.paragraph_format.first_line_indent=Cm(-.3);inline(p,line)
        elif line.startswith('- '):
            p=doc.add_paragraph();p.paragraph_format.left_indent=Cm(.3);p.paragraph_format.first_line_indent=Cm(-.3);inline(p,'• '+line[2:])
        else:
            p=doc.add_paragraph(style='Subtitle' if i in [2,4] else 'Normal');inline(p,line)
        i+=1
    target=path.with_suffix('.docx');doc.save(target)
    return {'source':path.name,'output':target.name,'sourceChars':len(path.read_text(encoding='utf-8')),'paragraphs':len(doc.paragraphs),'tables':len(doc.tables),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}

if __name__=='__main__':
    results=[build(p) for p in sorted(ROOT.glob('0[123]_*.md'))]
    (ROOT/'support'/'build-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False,indent=2))
