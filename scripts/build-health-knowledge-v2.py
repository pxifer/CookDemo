"""Add four authority-backed disease topics without rewriting the frozen v1 bundle."""
from pathlib import Path
import csv,hashlib,json,re,io

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'artifacts/tmp/health-sources'; OUT=ROOT/'datasets/health/2026-10-28-v2'; VERSION='2026-10-28-v2'
BASE=ROOT/'datasets/health/2026-10-28-v1'
bundle=json.loads((BASE/'knowledge-bundle.json').read_text(encoding='utf-8'))
base_hash=hashlib.sha256((BASE/'knowledge-bundle.json').read_bytes()).hexdigest()
bundle['id']='health-kb-'+VERSION
sources,entities,evidence,facts,rules,conflicts=[bundle[k] for k in ['sources','entities','evidence','facts','ruleDrafts','conflicts']]
em={e['id']:e for e in entities};evm={e['key']:e for e in evidence}
digest=lambda s:hashlib.sha256(s.encode('utf-8')).hexdigest()
compact=lambda s:re.sub(r'\s+','',s)
load=lambda name:json.loads((CACHE/name).read_text(encoding='utf-8'))
errors=[]
for sid,title,date in [('nhc-obesity-2024','成人肥胖食养指南（2024年版）','2024-02-08'),('nhc-ckd-2024','成人慢性肾脏病食养指南（2024年版）','2024-02-08'),('nhc-osteoporosis-2026','成人骨质疏松症食养指南（2026年版）','2026-05-26')]:
    m=load(sid+'.metadata.json')
    sources.append(dict(id=sid,title=title,version=sid[-4:],kind='national_guideline',publisher='国家卫生健康委办公厅；中国疾控营养与健康所或湖南省疾控中心公开副本',publicationDate=date,doi=None,url=m['url'],retrievedDate='2026-10-28',sourceHash=m['sha256'],pageCount=m['pages'],status='active',reuseScope='local_research_short_excerpts_and_factual_extraction',license='No blanket full-text redistribution license asserted; source attachments remain local verification copies.',verification='source_checked_by_project_agent; not clinical peer review',mediaType='application/pdf',**({'archiveMember':m['archiveMember']} if 'archiveMember'in m else {})))
lipid_url='https://www.chinacdc.cn/jkyj/yyyjk2/jswj13949/202504/t20250407_305765.html'
lipid_html=CACHE/'t20250407_305765.html.html'
sources.append(dict(id='cdc-dyslipidemia-2023',title='成人高脂血症食养指南（2023年版）',version='2023',kind='national_guideline',publisher='国家卫生健康委办公厅；中国疾病预防控制中心图像版',publicationDate='2023-01-12',doi=None,url=lipid_url,retrievedDate='2026-10-28',sourceHash=hashlib.sha256(lipid_html.read_bytes()).hexdigest(),pageCount=3,status='active',reuseScope='local_research_short_excerpts_and_factual_extraction',license='Only manually verified short excerpts and facts; full source image strips not redistributed.',verification='source_checked_by_project_agent; not clinical peer review',mediaType='text/html; image-strips=3'))

def ent(key,name,kind,aliases=(),form=None):
    if key not in em:
        row=dict(id=key,name=name,kind=kind,aliases=list(aliases),form=form,version=VERSION);entities.append(row);em[key]=row
    return key
L=ent('d:dyslipidemia','成人高脂血症','disease',['高脂血症','高血脂','血脂异常'])
O=ent('d:obesity','成人肥胖症','disease',['肥胖症','肥胖'])
K=ent('d:ckd','成人慢性肾脏病','disease',['慢性肾脏病','慢性肾病','CKD'])
B=ent('d:primary-osteoporosis','成人原发性骨质疏松症','disease',['原发性骨质疏松症'])
for slug,name,aliases in [('protein','蛋白质',[]),('phosphorus','磷',[]),('calcium','钙',[]),('vitamin-d','维生素D',['维生素 D']),('cholesterol','胆固醇',[]),('fat','脂肪',[]),('caffeine','咖啡因',[]),('oxalate','草酸',[]),('water','水分',[])]:ent('c:'+slug,name,'component',aliases)
for slug,name,form,aliases in [
 ('fish','鱼类','food_group',[]),('skinless-poultry','去皮禽肉','food_group',[]),('lean-meat','瘦肉','food_group',[]),
 ('fatty-meat','肥肉','food_group',[]),('sweet-cakes','含糖烘焙糕点','food_group',[]),('candies','糖果','food_group',[]),
 ('phosphate-additives-food','含磷添加剂较多的加工食品','food_group',[]),('low-protein-rice','低蛋白大米','processed',[]),
 ('mung-starch-noodles','绿豆粉丝','processed',[]),('plain-yogurt','无糖酸奶','fermented',[]),
 ('vitamin-d-fortified-milk','维生素D强化牛奶','fortified',[]),('egg-yolk','蛋黄','raw',[]),
 ('high-fat-marine-fish','高脂肪海鱼','food_group',[]),('strong-coffee','浓咖啡','liquid',[]),('strong-tea','浓茶','liquid',[]),
 ('low-sodium-potassium-salt','高钾低钠盐','seasoning',['低钠盐']),('vegetable-broth','菜汤','liquid',[]),
 ('low-fat-red-meat','低脂红肉','food_group',[]),('starch-roots','低蛋白淀粉类主食','food_group',[]),
]:ent('f:'+slug,name,'food_group' if form=='food_group' else 'food',aliases,form)
ent('p:vegetable-blanch-discard','蔬菜浸泡焯水弃汤','process',['蔬菜焯水弃汤'])
ent('p:steam-boil','蒸煮汆制','process',[])

def ev(key,sid,page,section,start,end=None):
    text=compact(load(sid+'.pages.json')[page-1]);needle=compact(start);a=text.find(needle)
    if a<0:errors.append('missing start '+key);a=0
    b=a+len(needle)
    if end:
        c=text.find(compact(end),b)
        if c<0:errors.append('missing end '+key+': '+end)
        else:b=c+len(compact(end))
    source=next(s for s in sources if s['id']==sid)
    locator=dict(kind='pdf_normalized_text',pdfPage=page,printedPage=page-(4 if sid=='nhc-osteoporosis-2026' else 2),section=section,start=a,end=b,normalization='remove_unicode_whitespace_v1')
    return evidence_row(key,source,locator,text[a:b],section)
def evidence_row(key,source,locator,quote,summary):
    row=dict(id='ev:'+digest(source['id']+'|'+source['sourceHash']+'|'+json.dumps(locator,sort_keys=True)+'|'+quote+'|proposition-v1'),key=key,sourceId=source['id'],sourceVersion=source['version'],sourceHash=source['sourceHash'],locator=locator,originalSpan=quote,spanHash=digest(quote),summary=summary,retrievalText=summary+' '+quote,chunkerVersion='proposition-v1',verification='source_checked',status='active')
    evidence.append(row);evm[key]=row
    return row['id']
def visual(key,page,section,quote,region):
    asset=load('cdc-dyslipidemia-2023.assets.json')[0]
    source=next(s for s in sources if s['id']=='cdc-dyslipidemia-2023')
    locator=dict(kind='html_visual',pdfPage=None,printedPage=page,section=section,start=None,end=None,normalization='remove_unicode_whitespace_v1',verifiedPageImageHash=asset['sha256'],assetUrl=asset['url'],imageRegion=region)
    return evidence_row(key,source,locator,quote,section+'；官方长图目视转录，未声称OCR或PDF字符定位。')

# Official long image strip, printed pages 2 and 5–7 (whole source asset hash + pixel area).
visual('lipid-scope',2,'前言/适用范围','有其他合并症的高脂血症人群，可参考（但不拘泥于）本指南制定食养方案，同时使用者应在医师或营养指导人员等专业人员的指导下，根据患者具体情况设计个性化食养方案。',[0,2100,700,2850])
visual('lipid-fat',5,'三（二）调控脂肪','限制总脂肪、饱和脂肪、胆固醇和反式脂肪酸的摄入，是防治高脂血症和动脉粥样硬化性心血管病的重要措施。',[0,4500,700,5400])
visual('lipid-cholesterol',5,'三（二）胆固醇/分型','高脂血症人群胆固醇每日摄入量应少于300mg，而高胆固醇血症者每日胆固醇摄入量应少于200mg，少吃富含胆固醇的食物，如动物脑和动物内脏等。',[0,4500,700,5400])
visual('lipid-trans',5,'三（二）反式脂肪与替代','三是反式脂肪酸摄入量应低于总能量的1%，即每天不宜超过2g，减少或避免食用部分氢化植物油等含有反式脂肪酸的食物。',[0,4500,700,5400])
visual('lipid-unsaturated',6,'三（二）不饱和脂肪酸','四是适当增加不饱和脂肪酸的摄入，特别是富含n-3系列多不饱和脂肪酸的食物。',[0,5300,700,5700])
visual('lipid-cooking',6,'三（二）烹调','高脂血症人群食物制作应选择少油蒸煮方式，减少食品过度加工，少用油炸、油煎等多油烹饪方法，多选择蒸、煮等方式。',[0,5300,700,5800])
visual('lipid-fiber',6,'三（三）膳食纤维','在主食中适当控制精白米面摄入，适量多吃富含膳食纤维丰富的食物，如全谷物、杂豆类、蔬菜等。膳食纤维能与胆酸结合，减少胆酸的吸收，从而降低血胆固醇水平。',[0,5500,700,6300])
visual('lipid-protein-foods',6,'三（三）蛋白质来源','蛋白质摄入应充足，动物蛋白摄入可适当选择脂肪含量较低的鱼虾类、去皮禽肉、瘦肉等；奶类可选择脱脂或低脂牛奶等。',[0,5700,700,6350])
visual('lipid-salt-sugar',7,'三（四）盐糖','限制单糖和双糖的摄入，少吃甜食；添加糖摄入不应超过总能量的10%，肥胖和高甘油三酯血症者添加糖摄入更低。',[0,6300,700,6900])
visual('lipid-alcohol',7,'三（四）饮酒','完全戒烟和有效避免吸入二手烟，有利于预防动脉粥样硬化性心血管疾病，并改善高密度脂蛋白胆固醇水平。研究证明即使少量饮酒也可使高甘油三酯血症人群甘油三酯水平进一步升高，因此提倡限制饮酒。',[0,6300,700,7050])

OB='nhc-obesity-2024'; CK='nhc-ckd-2024'; OP='nhc-osteoporosis-2026'
ev('ob-scope',OB,4,'前言/成人且无并发症','本指南主要面向基层卫生工作者','个性化食养方案。')
ev('ob-energy',OB,7,'三（一）总能量/个体化','控制总能量摄入和保持合理膳食是体重管理的关键。')
ev('ob-balanced',OB,8,'三（一）食物选择','鼓励主食以全谷物为主','应优先选择低脂或脱脂奶类。')
ev('ob-special-diets',OB,8,'三（一）特殊膳食需指导','必要时，可在医生或营养指导人员等专业人员指导下','间歇式断食膳食或营养代餐等其他膳食减重干预措施')
ev('ob-high-energy',OB,8,'三（二）高能量食物','高能量食物通常是指提供400kcal/100g以上能量的食物','如油炸食品、含糖烘焙糕点、糖果、肥肉等；')
ev('ob-fiber',OB,9,'三（二）纤维','减重期间应少吃高能量食物','如全谷物食物、蔬菜等。')
ev('ob-cooking',OB,9,'三（二）烹饪和食品','首先，应减少烹饪过程中烹调油、盐、糖用量','蜜饯、糖果、冰淇淋及含糖饮料等。')
ev('ob-alcohol',OB,9,'三（二）酒精','每克酒精可产生约7kcal能量','在减重期间应严格限制饮酒。')
ev('ob-special-populations',OB,11,'三（六）特殊人群减重','孕妇、乳母、老年人及患有慢性代谢性疾病的人群','避免不合')

ev('ck-scope',CK,4,'前言/个性化监测','使用者应在临床营养师和专科医生等专业人员的指导下','根据病情调整方案。')
ev('ck-early',CK,7,'三（一）1–2期','慢性肾脏病1～2期患者总体膳食建议','尽量不吃烟熏、烧烤、腌制等过度加工食品；')
ev('ck-late',CK,8,'三（一）3–5期与透析','慢性肾脏病3～5期患者总体膳食建议','依情况适当调整动物性食物、豆类、蔬菜和水果摄入量。')
ev('ck-protein',CK,9,'三（三）蛋白类型和量','蛋白质对于维持机体的组织更新和机体功能十分重要','优质蛋白通常富含于动物性食物和大豆中。')
ev('ck-soy',CK,10,'三（三）奶蛋磷和豆类','蛋类和奶类通常含磷较高','最后是蛋、奶、畜肉。')
ev('ck-fruit',CK,10,'三（四）蔬果/水肿高钾','当患者出现水肿或高钾血症时','必要时咨询临床营养师或专科医生。')
ev('ck-salt',CK,11,'三（五）少盐和调味品','控制饮食中盐的摄入量有利于改善慢性肾脏病患者的血压','尽量选择天然味道，如山楂、柠檬、辣椒、花椒、醋等。')
ev('ck-phosphorus-food',CK,11,'三（五）食物磷','磷与蛋白质并存','坚果粗粮含磷也较丰富。')
ev('ck-phosphate-additives',CK,12,'三（五）磷添加剂','在选择加工食品时，要通过阅读食品标签','避免选择含磷添加剂较多的食品。')
ev('ck-potassium-exception',CK,12,'三（五）钾的例外','若慢性肾脏病患者无高钾血症','建议慢性肾脏病患者根据具体情况个体化调整钾摄入量。')
ev('ck-hyperkalemia',CK,12,'三（五）高钾条件','出现高钾血症的患者应及时就医','推荐烹调时先飞水弃汤后食用。')
ev('ck-water',CK,12,'三（六）饮水条件','对于无水肿且尿量正常的慢性肾脏病患者','避免加重水肿。')
ev('ck-alcohol',CK,14,'三（九）饮酒分期','因此，慢性肾脏病患者应限制饮酒','慢性肾脏病3～5期患者不应饮酒。')

ev('op-scope',OP,7,'二（一）原发性范围','本指南主要针对成人原发性骨质疏松症','（不包括特发性骨质疏松症）。')
ev('op-nutrients',OP,8,'三（一）营养和骨矿化','钙是形成骨骼的基石','对骨骼矿化不可或缺。')
ev('op-calcium-foods',OP,9,'三（一）钙/食物','钙的主要食物来源为奶及其制品','建议每天应摄入300mL或以上的液态奶或相当量的奶制品。')
ev('op-vitamin-d',OP,9,'三（一）维生素D/作用','维生素D是防治骨质疏松症的关键营养素','从而引起或加重骨质疏松症。')
ev('op-vitamin-d-foods',OP,10,'三（一）天然和强化来源','食物如高脂肪海鱼','重要膳食选择。')
ev('op-protein',OP,10,'三（二）充足蛋白','蛋白质缺乏导致的肌少症被证实','因此，要保证摄入足量蛋白质。')
ev('op-soy-nuts',OP,11,'三（二）豆制品和坚果','植物性食物中，大豆类和坚果富含蛋白质','适量摄入坚果')
ev('op-vegetables',OP,12,'三（三）蔬菜与草酸','建议多吃新鲜蔬菜水果','避免影响钙吸收。')
ev('op-fermented-milk',OP,12,'三（三）发酵乳制品/乳糖不耐','建议每天奶制品的摄入中要注重发酵乳制品的摄入','如（无糖）酸奶或相应量的奶酪等。')
ev('op-alcohol',OP,14,'三（五）酒','因此提倡尽量不饮酒','如饮酒，每天酒精摄入量不超过15g')
ev('op-caffeine-sugar',OP,14,'三（五）糖和咖啡因','因此，应不喝或少喝含糖饮料和碳酸饮料','避免长期过量饮用浓茶、浓咖啡。')
ev('op-salt',OP,15,'三（六）盐与骨丢失','食物中钠盐摄入过多会引起高钙尿症','与骨质疏松风险呈正相关。')
ev('op-cooking',OP,15,'三（六）工艺和盐','因此应减少油炸、煎制、卤制等烹饪方式','少吃含钠高的调味品以及腊制、腌制或熏制的食物。')

def cond(key,*values):return dict(key=key,values=list(values))
ADULT=[cond('adult','yes')]
OB_SCOPE=ADULT+[cond('complexComorbidity','no'),cond('pregnantOrLactating','no')]
OP_SCOPE=ADULT+[cond('osteoporosisType','primary'),cond('complexComorbidity','no')]
def fact(key,kind,subject,obj,predicate,keys,statement,conditions=(),qualifiers=(),dose=False):
    row=dict(id='fact:'+key,version=VERSION,kind=kind,subjectId=subject,objectId=obj,predicate=predicate,statement=statement,conditions=list(conditions),quantity=None,doseDependent=dose,evidenceIds=[evm[k]['id']for k in keys],qualifyingEvidenceIds=[evm[k]['id']for k in qualifiers],sourceVersions={evm[k]['sourceId']:evm[k]['sourceVersion']for k in list(keys)+list(qualifiers)},reviewState='source_checked',clinicalReview='pending',validFrom='2026-10-28',withdrawnAt=None,scope='qualitative' if kind!='cooking_effect' else 'process_evidence_only_not_disease_rule',directness='source_statement')
    facts.append(row)
    if kind=='food_guidance':rules.append(dict(id='rule:'+key,version=VERSION,factId=row['id'],status='draft',reviewer=None))
    return row
def effect(key,dis,component,predicate,keys,statement,conditions=ADULT,qualifiers=(),dose=False):return fact(key,'disease_component',dis,'c:'+component,predicate,keys,statement,conditions,qualifiers,dose)
def guide(key,dis,food,action,keys,statement,conditions=ADULT,qualifiers=()):return fact(key,'food_guidance',dis,food if food.startswith('p:')else'f:'+food,action,keys,statement,conditions,qualifiers)
def contains(key,food,component,keys,statement,predicate='contains'):return fact(key,'food_component','f:'+food,'c:'+component,predicate,keys,statement)

effect('lipid-saturated-fat',L,'saturated-fat','adverse',['lipid-fat'],'指南支持限制饱和脂肪以管理血脂及心血管风险。',dose=True)
effect('lipid-trans-fat',L,'trans-fat','adverse',['lipid-trans'],'减少或避免部分氢化植物油等反式脂肪来源。',dose=True)
effect('lipid-unsaturated',L,'unsaturated-fat','beneficial_tendency',['lipid-unsaturated'],'以不饱和脂肪来源替代部分脂肪来源；不表示无限量补油。')
effect('lipid-fiber',L,'fiber','beneficial_tendency',['lipid-fiber'],'指南支持富纤维食物与减少胆酸吸收的解释，非任意纤维补充剂疗效。')
effect('lipid-cholesterol',L,'cholesterol','adverse',['lipid-cholesterol'],'胆固醇摄入限制随高胆固醇血症分型而不同，不转换为本餐阈值。',ADULT+[cond('lipidPattern','high_cholesterol','mixed')],dose=True)
effect('lipid-added-sugar',L,'added-sugar','adverse',['lipid-salt-sugar'],'添加糖限制尤其涉及高甘油三酯或肥胖情形。',ADULT+[cond('lipidPattern','high_triglycerides','mixed')],dose=True)
effect('lipid-ethanol',L,'ethanol','adverse',['lipid-alcohol'],'即使少量饮酒也可能使高甘油三酯人群甘油三酯升高。',ADULT+[cond('lipidPattern','high_triglycerides','mixed')])
for food,key in [('whole-grains','lipid-fiber'),('pulses','lipid-fiber'),('fresh-vegetables','lipid-fiber'),('fish','lipid-protein-foods'),('skinless-poultry','lipid-protein-foods'),('lean-meat','lipid-protein-foods'),('low-fat-milk','lipid-protein-foods')]:guide('lipid-prefer-'+food,L,food,'prefer',[key],'指南有直接食品选择支持，仍需整体膳食和个体条件核对。')
for food in ['organ-meat','liver']:guide('lipid-limit-'+food,L,food,'limit',['lipid-cholesterol'],'少选富胆固醇内脏，分型不能被忽略。',ADULT+[cond('lipidPattern','high_cholesterol','mixed')])
for food in ['sweet-cakes','candies','sweet-drinks']:guide('lipid-sugar-'+food,L,food,'limit',['lipid-salt-sugar'],'限制甜食与添加糖，尤其高甘油三酯者；不由糖检出推出绝对禁食。')
guide('lipid-alcohol',L,'alcohol','limit',['lipid-alcohol'],'限制饮酒，不把低嘌呤当作低血脂风险。')
guide('lipid-fry',L,'p:fry','limit',['lipid-cooking'],'少用多油煎炸方式。')
guide('lipid-steam',L,'p:steam-boil','prefer',['lipid-cooking'],'优先少油蒸煮方式。')

effect('ob-fat',O,'fat','conditional',['ob-cooking','ob-energy'],'减重期间控制脂肪/油摄入与总能量；不是所有脂肪均禁用。',OB_SCOPE,dose=True)
effect('ob-fiber',O,'fiber','beneficial_tendency',['ob-fiber'],'全谷物和蔬菜等富纤维食品可纳入控制总能量的饮食。',OB_SCOPE)
effect('ob-added-sugar',O,'added-sugar','adverse',['ob-cooking'],'限制添加糖和含糖加工食品，保留总能量管理背景。',OB_SCOPE,dose=True)
effect('ob-ethanol',O,'ethanol','adverse',['ob-alcohol'],'酒精提供能量，减重期间严格限制饮酒。',OB_SCOPE,dose=True)
for food in ['whole-grains','fresh-vegetables','skinless-poultry','fish','low-fat-milk','lean-meat']:guide('ob-prefer-'+food,O,food,'prefer',['ob-balanced','ob-fiber'],'指南支持合理搭配中的优先选择，不给个人极低热量或药物方案。',OB_SCOPE,qualifiers=['ob-special-populations'])
for food in ['fried-food','sweet-cakes','candies','fatty-meat','sweet-drinks','preserved-fruit']:guide('ob-limit-'+food,O,food,'limit',['ob-high-energy','ob-cooking'],'减重期间少选高能量或含糖加工食品，非任意量绝对禁止。',OB_SCOPE)
guide('ob-alcohol',O,'alcohol','limit',['ob-alcohol'],'减重期间严格限酒。',OB_SCOPE)
guide('ob-fry',O,'p:fry','limit',['ob-cooking'],'减少油煎炸，不能凭菜名推算吸油率。',OB_SCOPE)
guide('ob-steam',O,'p:steam-boil','prefer',['ob-cooking'],'在配方和实际用油满足要求时选择少油蒸煮。',OB_SCOPE)

effect('ck-protein',K,'protein','conditional',['ck-protein','ck-late'],'蛋白质有必要营养作用，过多增加肾负担；分期及透析状态决定方案。',ADULT+[cond('ckdStage','G1','G2','G3','G4','G5'),cond('dialysis','yes','no')],qualifiers=['ck-scope'],dose=True)
effect('ck-sodium',K,'sodium','adverse',['ck-salt'],'控制盐摄入有助血压、蛋白尿和水肿管理；水肿相关数值不自动执行。',dose=True)
effect('ck-phosphorus',K,'phosphorus','conditional',['ck-phosphorus-food','ck-phosphate-additives'],'磷来源及吸收率不同，按血磷与营养计划管理，不一律禁全部蛋白食物。',ADULT+[cond('clinicianNutritionPlan','yes')],dose=True)
effect('ck-potassium',K,'potassium','conditional',['ck-potassium-exception','ck-hyperkalemia'],'钾是必需营养物质；高钾血症才触发相应限制，低或高血钾均有风险。',ADULT+[cond('hyperkalemia','yes','no'),cond('urineOutputCategory','over_1000ml_daily','reduced','unknown_clinical')],dose=True)
effect('ck-water',K,'water','conditional',['ck-water'],'饮水方案随水肿、尿量及透析脱水量调整，不直接沿用痛风足量饮水。',ADULT+[cond('edema','yes','no'),cond('urineOutputCategory','normal','reduced'),cond('clinicianNutritionPlan','yes')],dose=True)
for food in ['salt','soy-sauce','chicken-seasoning','msg']:guide('ck-limit-'+food,K,food,'limit',['ck-salt'],'限制盐和高钠调味品；未据此生成统一每餐钠阈值。')
guide('ck-phosphate-food',K,'phosphate-additives-food','limit',['ck-phosphate-additives'],'阅读标签，避免选择含磷添加剂较多的食品；品牌组成须有标签事实。')
for food in ['whole-grains','pulses','soy-products']:guide('ck-early-'+food,K,food,'prefer',['ck-early'],'1–2期总体建议中的食物选择，不外推至所有晚期或透析患者。',ADULT+[cond('ckdStage','G1','G2'),cond('dialysis','no'),cond('clinicianNutritionPlan','yes')])
for food in ['low-protein-rice','mung-starch-noodles','starch-roots']:guide('ck-late-'+food,K,food,'prefer',['ck-late','ck-protein'],'在3–5期非透析且专业计划明确低蛋白主食替换时采用，不调整药物或全天蛋白处方。',ADULT+[cond('ckdStage','G3','G4','G5'),cond('dialysis','no'),cond('clinicianNutritionPlan','yes')])
for food in ['fresh-vegetables','fresh-fruit']:guide('ck-produce-'+food,K,food,'prefer',['ck-fruit'],'未合并水肿或高钾且已有个性化方案时，可纳入适量蔬果。',ADULT+[cond('edema','no'),cond('hyperkalemia','no'),cond('clinicianNutritionPlan','yes')],qualifiers=['ck-potassium-exception'])
for food in ['stew-broth','vegetable-broth','low-sodium-potassium-salt']:guide('ck-high-k-'+food,K,food,'avoid',['ck-hyperkalemia'] if food!='low-sodium-potassium-salt' else ['ht24-salt'],'高钾血症下避免相关汤汁或高钾低钠盐；不能用这一条件禁所有肾病食物。',ADULT+[cond('hyperkalemia','yes')],qualifiers=['ck-potassium-exception'])
guide('ck-blanch',K,'p:vegetable-blanch-discard','prefer',['ck-fruit','ck-hyperkalemia'],'高钾血症情况下按专业计划浸泡焯水弃汤；不保证全部去钾。',ADULT+[cond('hyperkalemia','yes'),cond('clinicianNutritionPlan','yes')])
guide('ck-alcohol-general',K,'alcohol','limit',['ck-alcohol'],'慢性肾病一般限酒或不饮酒。')
guide('ck-alcohol-late',K,'alcohol','avoid',['ck-alcohol'],'3–5期指南明确不应饮酒。',ADULT+[cond('ckdStage','G3','G4','G5')])

effect('op-calcium',B,'calcium','beneficial_tendency',['op-nutrients','op-calcium-foods'],'充足膳食钙有助维持血钙和减少骨流失，不能理解为补得越多越好。',OP_SCOPE)
effect('op-vitamin-d',B,'vitamin-d','beneficial_tendency',['op-vitamin-d'],'维生素D促进钙吸收和骨代谢；本库不发补充剂剂量。',OP_SCOPE)
effect('op-protein',B,'protein','conditional',['op-protein'],'保证足量蛋白，不能与肾病低蛋白建议机械合并。',OP_SCOPE,dose=True)
effect('op-sodium',B,'sodium','adverse',['op-salt'],'钠盐过多关联尿钙排泄和骨丢失。',OP_SCOPE,dose=True)
effect('op-caffeine',B,'caffeine','conditional',['op-caffeine-sugar'],'限制长期过量浓茶浓咖啡，不等同禁止一切茶和咖啡。',OP_SCOPE,dose=True)
effect('op-ethanol',B,'ethanol','adverse',['op-alcohol'],'尽量不饮酒，原文上限不是安全阈值。',OP_SCOPE,dose=True)
for food,key in [('milk','op-calcium-foods'),('soy-products','op-soy-nuts'),('nuts-unsalted','op-soy-nuts'),('high-fat-marine-fish','op-vitamin-d-foods'),('vitamin-d-fortified-milk','op-vitamin-d-foods'),('fresh-vegetables','op-vegetables'),('fresh-fruit','op-vegetables')]:guide('op-prefer-'+food,B,food,'prefer',[key],'成人原发性骨质疏松饮食可选，仍需个体限制和其他疾病复核。',OP_SCOPE)
guide('op-yogurt',B,'plain-yogurt','prefer',['op-fermented-milk'],'无糖发酵乳可作奶类选择；乳糖不耐不等于牛奶蛋白过敏已排除。',OP_SCOPE)
for food,key in [('salt','op-cooking'),('cured-meat','op-cooking'),('sweet-drinks','op-caffeine-sugar'),('strong-tea','op-caffeine-sugar'),('strong-coffee','op-caffeine-sugar'),('alcohol','op-alcohol')]:guide('op-limit-'+food,B,food,'limit',[key],'保留原文少选或尽量不饮方向，不扩大为任意量绝对禁用。',OP_SCOPE)
guide('op-fry',B,'p:fry','limit',['op-cooking'],'减少多油煎炸。',OP_SCOPE)
guide('op-steam',B,'p:steam-boil','prefer',['op-cooking'],'优先蒸煮汆等少油工艺。',OP_SCOPE)

for food in ['milk','soy-products','fresh-vegetables']:contains('op-calcium-'+food,food,'calcium',['op-calcium-foods'],'指南列举的钙来源，形态和具体含量未在本批量化。')
for food in ['high-fat-marine-fish','egg-yolk','vitamin-d-fortified-milk']:contains('op-d-'+food,food,'vitamin-d',['op-vitamin-d-foods'],'指南列举的天然或强化维生素D来源，不能当所有普通奶都强化。')
for food in ['fish','skinless-poultry','soy-products','milk']:contains('ck-protein-'+food,food,'protein',['ck-protein','ck-soy'],'蛋白来源；成分存在不自动表示对某疾病有益或应避免。')
for food in ['milk','egg-yolk','liver','nuts-unsalted']:contains('ck-phosphorus-'+food,food,'phosphorus',['ck-phosphorus-food'],'指南食物磷资料，未导入品牌或精确含量。')
contains('op-oxalate-spinach','spinach','oxalate',['op-vegetables'],'指南将菠菜列为较高草酸蔬菜，工艺建议另行保存。')
contains('low-na-salt-potassium','low-sodium-potassium-salt','potassium',['ht24-salt'],'低钠盐的高钾属性及禁忌依据，不据名称推测任意品牌具体比例。')
fact('ck-blanch-potassium','cooking_effect','p:vegetable-blanch-discard','c:potassium','may_decrease',['ck-hyperkalemia'],'指南支持高钾情况下先飞水弃汤；未提供通用去除率。',[cond('inputFoodClass','vegetables'),cond('medium','water'),cond('brothDisposition','discarded')])
guide('op-spinach-blanch',B,'p:vegetable-blanch-discard','prefer',['op-vegetables'],'菠菜等高草酸蔬菜焯水后食用，不能把草酸存在升级为菠菜禁食。',OP_SCOPE)

conflicts.append(dict(id='conflict:ckd-osteoporosis-protein',kind='cross_disease_applicability',factIds=['fact:ck-protein','fact:op-protein'],resolution='combination_not_approved',note='晚期非透析肾病与骨质疏松的蛋白方向可能不同；不以有益分抵消、不机械取最严，组合须个性化专业方案。'))
bundle['boundaries']['expandedDiseaseTopics']=['d:dyslipidemia','d:obesity','d:ckd','d:primary-osteoporosis']
bundle['boundaries']['parentBundle']={'id':'health-kb-2026-10-28-v1','sha256':base_hash}
bundle['boundaries']['researchRetrieval']='lexical-v2; original A0 retained for comparison'
if errors:raise ValueError('\n'.join(errors))
OUT.mkdir(parents=True,exist_ok=True)
def write_frozen(name,text,encoding='utf-8'):
    path=OUT/name
    if path.exists():
        if path.read_text(encoding=encoding)!=text:raise ValueError('Frozen bundle differs; create a new version: '+name)
    else:path.write_text(text,encoding=encoding,newline='')
def write_json(name,obj):write_frozen(name,json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
write_json('knowledge-bundle.json',bundle)
for name,rows in [('sources',sources),('entities',entities),('evidence',evidence),('facts',facts),('rule-drafts',rules),('conflicts',conflicts)]:
    write_frozen(name+'.jsonl',''.join(json.dumps(r,ensure_ascii=False,separators=(',',':'))+'\n'for r in rows))
stream=io.StringIO(newline='')
writer=csv.writer(stream);writer.writerow(['id','kind','subject_id','subject_name','predicate','object_id','object_name','conditions_json','quantity_json','evidence_ids_json','statement','review_state','clinical_review'])
for r in facts:writer.writerow([r['id'],r['kind'],r['subjectId'],em[r['subjectId']]['name'],r['predicate'],r['objectId'],em[r['objectId']]['name'],json.dumps(r['conditions'],ensure_ascii=False),json.dumps(r['quantity'],ensure_ascii=False),json.dumps(r['evidenceIds']),r['statement'],r['reviewState'],r['clinicalReview']])
write_frozen('relations.csv',stream.getvalue().replace('\r\n','\n'),'utf-8-sig')
manifest=dict(id=bundle['id'],schemaVersion='1.0.0',status='research_ready',createdDate='2026-10-28',parentBundle={'id':'health-kb-2026-10-28-v1','sha256':base_hash},files={p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(OUT.iterdir())if p.suffix in('.json','.jsonl','.csv')and p.name!='manifest.json'},counts={k:len(bundle[k])for k in['sources','entities','evidence','facts','ruleDrafts','conflicts','recipeBindings']},index=dict(kind='structured_plus_controlled_keywords',version='lexical-v2',embedding=None,reranker=None),clinicalRelease=None)
write_json('manifest.json',manifest)
print(json.dumps(manifest['counts'],ensure_ascii=False))
