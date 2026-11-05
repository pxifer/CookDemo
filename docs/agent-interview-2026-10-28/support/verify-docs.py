from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import re,json,hashlib
ROOT=Path(__file__).resolve().parent.parent
errors=[];checks=[]
for file in sorted(ROOT.glob('*.md')):
    text=file.read_text(encoding='utf-8')
    missing=[]
    for label,target in re.findall(r'\[([^\]]+)\]\(([^)]+)\)',text):
        if target.startswith(('http://','https://','#')):continue
        actual=(file.parent/target.split('#')[0]).resolve()
        if not actual.exists():missing.append(target)
    if missing:errors.append({'file':file.name,'missingLinks':missing})
    if re.search(r'turn\d+(?:view|search)|TODO|待补数字|准确率100%',text):
        # A warning example in prose is allowed; unknown citation tokens are not.
        if re.search(r'turn\d+(?:view|search)',text):errors.append({'file':file.name,'error':'internal citation token'})
    if text.count('```')%2:errors.append({'file':file.name,'error':'unclosed code fence'})
    checks.append({'file':file.name,'chars':len(text),'headings':len(re.findall(r'^#{1,3} ',text,re.M)),'externalLinks':len(re.findall(r'\]\(https?://',text))})
qtext=next(ROOT.glob('01_*.md')).read_text(encoding='utf-8')
qids=re.findall(r'^### Q(\d+) ',qtext,re.M)
if qids!=[f'{i:02}' for i in range(1,91)]:errors.append({'error':'question numbering','ids':qids})
W={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
for path in sorted(ROOT.glob('0*.docx')):
    with ZipFile(path) as z:
        xml=ET.fromstring(z.read('word/document.xml'))
        t=''.join(xml.itertext())
        if '\ufffd' in t:errors.append({'file':path.name,'error':'replacement glyph in source'})
        for props in xml.findall('.//w:trPr',W):
            if props.find('w:trHeight',W) is not None:errors.append({'file':path.name,'error':'fixed row height'})
        for cell in xml.findall('.//w:tc',W):
            if cell.find('w:tcPr/w:tcBorders',W) is None:errors.append({'file':path.name,'error':'table missing borders'})
        headings=xml.findall('.//w:bookmarkStart',W)
        checks.append({'file':path.name,'bytes':path.stat().st_size,'bookmarks':len(headings),'tables':len(xml.findall('.//w:tbl',W)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
report={'date':'2026-10-28','questions':len(qids),'checks':checks,'errors':errors,'scope':'content and OOXML; visual QA recorded separately'}
(ROOT/'support'/'validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'questions':len(qids),'files':len(checks),'errors':errors},ensure_ascii=True))
raise SystemExit(bool(errors))
