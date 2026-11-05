"""Build additive qualitative goal research data from pinned public local source files.
Requires the isolated parser environment in .local-data/rag-business/parser.
No model, user profile, numeric intake prescription or online publication.
"""
from pathlib import Path
from html.parser import HTMLParser
from pypdf import PdfReader
import hashlib,json,re

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.local-data/rag-business/sources'
OUT=ROOT/'datasets/health/goal-guidance-2026-11-04-v1'
OUT.mkdir(parents=True,exist_ok=True)
digest=lambda s:hashlib.sha256(s.encode('utf-8')).hexdigest()
compact=lambda s:re.sub(r'\s+','',s)
class Text(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,t):self.parts.append(t)

pdf=CACHE/'nhc-weight-2024.pdf'
page=compact(PdfReader(pdf).pages[9].extract_text())
html=CACHE/'issn-protein-2017.html'
parser=Text();parser.feed(html.read_text(encoding='utf-8'))
body=re.sub(r'\s+',' ',' '.join(parser.parts))
evidence=[]
def ev(key,source,title,version,url,raw,text,quote,locator):
    assert quote in text,(key,'excerpt missing')
    row=dict(id='goal-ev:'+key,sourceId=source,title=title,version=version,url=url,sourceHash=hashlib.sha256(raw.read_bytes()).hexdigest(),originalSpan=quote,locator={**locator,'start':text.index(quote),'end':text.index(quote)+len(quote)},spanHash=digest(quote))
    evidence.append(row);return row['id']
w=ev('weight-food-method','nhc-weight-management-2024','体重管理指导原则（2024年版）','2024','https://www.nhc.gov.cn/wjw/ylyjs/202412/b3d40e0141834897808ce6c9dce76a60.shtml',pdf,page,'减少高糖、高油、高盐食物。选择蒸、煮、炖、拌，减少煎、烤、炸等烹饪方式。',{'kind':'pdf_normalized_text','pdfPage':10,'normalization':'remove_unicode_whitespace_v1','section':'四、体重管理策略/合理膳食'})
common=('issn-protein-exercise-2017','International Society of Sports Nutrition Position Stand: protein and exercise','2017','https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/',html,body)
scope=ev('exercise-scope',*common,'healthy, exercising individuals',{'kind':'html_normalized_text','normalization':'collapse_whitespace_v1','section':'Position statement'})
egg=ev('exercise-egg',*common,'eggs are an excellent source of protein for athletes.',{'kind':'html_normalized_text','normalization':'collapse_whitespace_v1','section':'Egg proteins'})
beef=ev('exercise-beef',*common,'Beef is a common source of dietary protein',{'kind':'html_normalized_text','normalization':'collapse_whitespace_v1','section':'Beef and other flesh proteins'})
adult=[{'key':'adult','values':['yes']}]
muscle=adult+[{'key':'healthyExerciser','values':['yes']},{'key':'resistanceTraining','values':['yes']}]
def fact(id,topic,obj,name,kind,direction,statement,conditions,support,qualify=(),basis='source_statement'):
    return dict(id='goal:'+id,topicId='goal:'+topic,objectId=obj,objectName=name,objectKind=kind,direction=direction,statement=statement,conditions=conditions,evidenceIds=list(support),qualifyingEvidenceIds=list(qualify),basis=basis)
data=dict(id='goal-guidance-2026-11-04-v1',status='local_research',clinicalRelease=None,professionalReview='pending',topics=[{'id':'goal:fat-loss','name':'减脂','aliases':['瘦身','减肥','体重管理']},{'id':'goal:muscle-gain','name':'增肌','aliases':['增加肌肉','力量训练增肌']}],evidence=evidence,facts=[
    fact('fat-loss-limit-sugar','fat-loss','f:added-sugar','白糖','food','limit','按体重管理的少高糖方向提示添加白糖原料；不以含糖认定整菜高糖，不生成全天或每餐阈值。',adult,[w],basis='project_interpretation'),
    fact('fat-loss-steam-boil','fat-loss','p:steam-boil','蒸煮汆制','process','prefer','体重管理可优先采用来源列举的蒸煮做法；实际配方、其他步骤与本餐条件仍须核对。',adult,[w]),
    fact('fat-loss-limit-fry','fat-loss','p:fry','油炸或煎制','process','limit','体重管理少选来源列举的煎炸做法；不从菜名推断实际工艺、摄入能量或减脂效果。',adult,[w]),
    fact('muscle-prefer-egg','muscle-gain','f:egg','鸡蛋','food','prefer','在健康成年且进行抗阻训练的本轮范围中，鸡蛋可作为膳食蛋白来源候选；不是整菜增肌保证，不推定个人蛋白需求或无限量摄入。',muscle,[egg],[scope]),
    fact('muscle-prefer-beef','muscle-gain','f:beef','牛肉','food','prefer','在健康成年且进行抗阻训练的本轮范围中，牛肉可作为膳食蛋白来源候选；不据此宣称低脂、疾病适宜性或个人定量达标。',muscle,[beef],[scope]),
])
out=OUT/'knowledge.json';payload=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
if out.exists() and out.read_text(encoding='utf-8')!=payload:raise ValueError('GOAL_KNOWLEDGE_IMMUTABLE_USE_NEW_VERSION')
out.write_text(payload,encoding='utf-8')
manifest={'id':data['id'],'files':{'knowledge.json':hashlib.sha256(out.read_bytes()).hexdigest()},'sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [pdf,html]},'scope':'qualitative goal research, no numerical intake prescription','sourceVerification':'project source extraction, not independent human or clinical review'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'id':data['id'],'facts':len(data['facts']),'evidence':len(evidence),'state':'source_spans_verified'},ensure_ascii=False))
