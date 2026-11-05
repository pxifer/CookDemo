"""Rebuild the curated public research KB from verified source snapshots.

Run research-health-sources.py and research-health-html.py first. This script
does not use an LLM, infer missing amounts, or approve clinical rules.
"""
from pathlib import Path
import csv
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts/tmp' / 'health-sources'
OUT = ROOT / 'datasets' / 'health' / '2026-10-28-v1'
VERSION = '2026-10-28-v1'
OUT.mkdir(parents=True, exist_ok=True)
def digest(value): return hashlib.sha256(value.encode('utf-8')).hexdigest()
def compact(value): return re.sub(r'\s+', '', value)
def load(name): return json.loads((CACHE / name).read_text(encoding='utf-8'))
sources, entities, evidence, facts, rules, conflicts = [], [], [], [], [], []
entity_map, evidence_map = {}, {}
errors = []

source_specs = [
 ('nhc-hypertension-2023', '成人高血压食养指南（2023年版）', '2023', 'national_guideline', '国家卫生健康委办公厅', '2023-01-12', None),
 ('nhc-diabetes-2023', '成人糖尿病食养指南（2023年版）', '2023', 'national_guideline', '国家卫生健康委办公厅', '2023-01-12', None),
 ('nhc-gout-2024', '成人高尿酸血症与痛风食养指南（2024年版）', '2024', 'national_guideline', '国家卫生健康委办公厅；湖南省疾控中心公开副本', '2024-02-08', None),
 ('nhc-hypertension-principles-2024', '高血压营养和运动指导原则（2024年版）', '2024', 'national_guideline', '国家卫生健康委办公厅；中国政府网附件', '2024-07-01', None),
 ('kaneko-purines-2014', 'Total Purine and Purine Base Content of Common Foodstuffs for Facilitating Nutritional Therapy for Gout and Hyperuricemia', '2014', 'peer_reviewed_composition', 'Biological and Pharmaceutical Bulletin / The Pharmaceutical Society of Japan', '2014-05', '10.1248/bpb.b13-00967'),
 ('shinoda-cooking-1982', 'Purine Base Contents in Foods and Effects of Cooking Methods', '1982', 'peer_reviewed_experiment', 'Eiyo To Shokuryo / Japanese Society of Nutrition and Food Science', '1982-04-10', '10.4327/jsnfs1949.35.103'),
 ('nci-cooked-meats-2017', 'Chemicals in Meat Cooked at High Temperatures and Cancer Risk', 'reviewed-2017-07-11', 'national_institute_summary', 'National Cancer Institute, NIH', '2017-07-11', None),
]
for sid, title, version, kind, publisher, date, doi in source_specs:
    meta = load(sid + '.metadata.json')
    sources.append(dict(id=sid, title=title, version=version, kind=kind, publisher=publisher,
      publicationDate=date, doi=doi, url=meta['url'], retrievedDate='2026-10-28',
      sourceHash=meta['sha256'], pageCount=meta['pages'], status='active',
      reuseScope='local_research_short_excerpts_and_factual_extraction',
      license='No blanket full-text redistribution license asserted; link to publisher. No full PDF/HTML distributed in this bundle.',
      verification='source_checked_by_project_agent; not clinical peer review'))

def ent(key, name, kind, aliases=(), form=None):
    if key not in entity_map:
        e = dict(id=key, name=name, kind=kind, aliases=list(aliases), form=form, version=VERSION)
        entities.append(e); entity_map[key] = e
    return key

HT = ent('d:hypertension', '成人高血压', 'disease', ['高血压', '高血压病'])
DM = ent('d:type2-diabetes', '成人2型糖尿病', 'disease', ['2型糖尿病', '二型糖尿病', 'T2DM'])
GO = ent('d:gout', '成人痛风', 'disease', ['痛风'])
HU = ent('d:hyperuricemia', '成人高尿酸血症', 'disease', ['高尿酸血症'])
for key, name, aliases in [
 ('sodium','钠',['钠盐']),('potassium','钾',[]),('saturated-fat','饱和脂肪酸',[]),
 ('unsaturated-fat','不饱和脂肪酸',[]),('trans-fat','反式脂肪酸',[]),('fiber','膳食纤维',[]),
 ('carbohydrate','碳水化合物',[]),('added-sugar','添加糖',[]),('fructose','果糖',[]),
 ('ethanol','乙醇',['酒精']),('purines','总嘌呤',['嘌呤']),('milk-protein','乳蛋白',[]),
 ('hca','杂环胺',['HCA','HCAs']),('pah','多环芳烃',['PAH','PAHs']),
]: ent('c:'+key,name,'component',aliases)

food_specs = [
 ('salt','食盐','seasoning',['盐']),('soy-sauce','酱油','seasoning',[]),('oyster-sauce','蚝油','seasoning',[]),
 ('chicken-seasoning','鸡精','seasoning',[]),('msg','味精','seasoning',[]),('fermented-bean-curd','腐乳','processed',[]),
 ('pickles','咸菜','processed',['腌菜']),('sausage','香肠','processed',[]),('bacon','培根','processed',[]),
 ('cured-meat','腊肉','processed',[]),('fresh-vegetables','新鲜蔬菜','food_group',[]),
 ('fresh-fruit','完整新鲜水果','food_group',['新鲜水果']),('whole-grains','全谷物','food_group',[]),
 ('pulses','杂豆','food_group',[]),('soy-products','大豆制品','food_group',[]),('milk','牛奶','liquid',[]),
 ('low-fat-milk','低脂或脱脂奶','liquid',[]),('tofu','豆腐','fresh',[]),('dried-tofu','豆腐干','processed',['豆干']),
 ('nuts-unsalted','原味坚果','food_group',[]),('sweet-drinks','含糖饮料','food_group',[]),
 ('juice','鲜榨果汁','liquid',[]),('fructose-syrup','果葡糖浆','processed',[]),('preserved-fruit','果脯蜜饯','processed',[]),
 ('alcohol','含酒精饮品','food_group',[]),('liver','动物肝脏','raw',[]),('kidney','动物肾脏','raw',[]),
 ('organ-meat','动物内脏','food_group',[]),('egg-white','鸡蛋蛋白','raw',['蛋清']),
 ('spinach','菠菜','raw',[]),('chinese-kale','芥兰','raw',[]),('water-spinach','空心菜','raw',[]),
 ('rape','油菜','raw',[]),('lettuce','生菜','raw',[]),('carrot','胡萝卜','raw',[]),('potato','马铃薯','raw',['土豆']),
 ('sweet-potato','甘薯','raw',['红薯']),('shiitake-fresh','香菇（鲜）','fresh',['鲜香菇']),
 ('enoki-fresh','金针菇（鲜）','fresh',['鲜金针菇']),('button-mushroom-fresh','口蘑（鲜）','fresh',['鲜口蘑']),
 ('nori-dry','紫菜（干）','dried',['干紫菜']),('oats','燕麦','unspecified',[]),
 ('rice-unspecified','大米（形态未细分）','unspecified',[]),('buckwheat','荞麦','unspecified',[]),
 ('cauliflower','菜花','raw',['花菜']),('green-bean','豆角','raw',[]),('beef','牛肉','raw',[]),
 ('pork','猪肉','raw',[]),('lamb','羊肉','raw',[]),('duck','鸭肉','raw',[]),('squid','鱿鱼','raw',[]),
 ('mussel','贻贝','raw',[]),('oyster','生蚝','raw',[]),('stew-broth','肉汤','liquid',[]),
 ('rice-polished-dry','精白米（论文样品）','uncooked',[]),('rice-brown-dry','糙米（论文样品）','uncooked',[]),
 ('soybean-dry','大豆（干）','dried',[]),('tofu-kinu','绢豆腐（Kinu论文样品）','fresh',[]),
 ('tofu-momen-chilled','木棉豆腐（冷藏论文样品）','chilled',[]),('tofu-momen-boiled','木棉豆腐（煮3分钟论文样品）','boiled',[]),
 ('soymilk-sample','豆浆（论文样品）','liquid',[]),('shiitake-dry','香菇（干）','dried',['干香菇']),
 ('cucumber','黄瓜','raw',[]),('cabbage','卷心菜','raw',['圆白菜']),('broccoli','西兰花','raw',[]),
 ('canola-oil','菜籽油','oil',[]),('flax-oil','亚麻籽油','oil',[]),('olive-oil','橄榄油','oil',[]),
 ('sunflower-oil','葵花籽油','oil',[]),('corn-oil','玉米油','oil',[]),
 ('fried-food','油炸食品','food_group',[]),('muscle-meat','肌肉类肉食','food_group',[]),
 ('reused-oil','反复使用的油','oil',[]),('hydrogenated-oil','氢化植物油','oil',[]),
 ('shortening','起酥油','oil',[]),('margarine','人造奶油','processed',[]),
]
for key,name,form,aliases in food_specs: ent('f:'+key,name,'food_group' if form=='food_group' else 'food',aliases,form)
for key,name in [('boil-discard','汆煮并弃汤'),('boil-keep','煮后连汤食用'),('reduce-broth','汤汁收浓'),
                 ('fry','油炸或煎制'),('high-heat-meat','肉类高温煎烤'),('smoke-meat','肉类烟熏'),
                 ('flame-smoke','肉汁滴入明火产生烟雾'),('microwave-preheat','微波预熟后高温烹调'),('soy-processing','大豆加工成豆制品')]:
    ent('p:'+key,name,'process')

H='nhc-hypertension-2023'; D='nhc-diabetes-2023'; G='nhc-gout-2024'; P='kaneko-purines-2014'; H24='nhc-hypertension-principles-2024'

def ev(key, sid, page, section, start, end=None, summary='', visual=False):
    text = compact(load(sid+'.pages.json')[page-1])
    needle = compact(start)
    offset = text.find(needle)
    if visual:
        quote, offset, stop = start, None, None
    else:
        if offset < 0:
            errors.append(f'Excerpt not found: {key}: {needle}')
            offset = 0
        stop = offset + len(needle)
        if end:
            ending = text.find(compact(end), stop)
            if ending < 0:
                errors.append(f'End not found: {key}: {end}')
            else:
                stop = ending + len(compact(end))
        quote = text[offset:stop]
    source = next(s for s in sources if s['id']==sid)
    locator = dict(kind='pdf_visual' if visual else ('html_normalized_text' if source['pageCount']==1 else 'pdf_normalized_text'),
      pdfPage=page if source['pageCount']>1 else None, printedPage=(page-2 if sid in (H,D,G) else (708+page if sid==P else page+2)) if source['pageCount']>1 else None,
      section=section, start=offset, end=stop, normalization='remove_unicode_whitespace_v1')
    if visual:
        image = CACHE/(sid+'-p'+str(page)+'.png')
        locator['verifiedPageImageHash'] = hashlib.sha256(image.read_bytes()).hexdigest()
    eid='ev:'+digest(sid+'|'+source['sourceHash']+'|'+json.dumps(locator,sort_keys=True)+'|'+quote+'|proposition-v1')
    e=dict(id=eid,key=key,sourceId=sid,sourceVersion=source['version'],sourceHash=source['sourceHash'],
      locator=locator,originalSpan=quote,spanHash=digest(quote),summary=summary,
      retrievalText=section+' '+summary+' '+quote,chunkerVersion='proposition-v1',
      verification='source_checked',status='active')
    evidence.append(e);evidence_map[key]=e
    return eid

# Evidence units preserve recommendation conditions; printed pages differ from PDF pages.
ev('ht-scope',H,4,'前言/适用范围','本指南主要面向成人高血压患者', '个性化食养方案。',summary='成人高血压适用；合并疾病需个性化。')
ev('ht-sodium',H,6,'三（一）减钠增钾','钠盐摄入过多可增加高血压风险。',summary='钠盐过量增加风险，限制各来源钠。')
ev('ht-potassium',H,7,'三（一）钾与肾功能','增加膳食中钾摄入量可降低血压。','肾功能不全者补钾前应咨询医生。',summary='增加富钾食物；低钠盐须核对肾功能；不建议钾补充剂降压。')
ev('ht-fat',H,7,'三（一）脂肪和加工红肉','膳食中的饱和脂肪酸可以升高血脂','如培根、香肠、腊肠等。',summary='饱和脂肪关联心血管结局；少选油炸、内脏和加工红肉。')
ev('ht-fiber-food',H,7,'三（二）合理膳食','推荐高血压患者多吃含膳食纤维丰富的蔬果','限制添加糖摄入；',summary='直接支持蔬果、全谷物、奶、鱼及豆制品的膳食选择。')
ev('ht-condiments',H,8,'三（二）含钠调味品','味品（酱油、酱类、蚝油、鸡精、味精等）。',summary='酱油、蚝油、鸡精、味精属于此处限制的含钠调味品。')
ev('ht-alcohol',H,9,'三（四）饮酒','不饮或限制饮酒。','饮酒者尽量戒酒。',summary='指南建议不饮酒或尽量戒酒，不能给出安全饮酒量。')
ev('ht-dash',H,10,'三（五）得舒饮食','1.得舒饮食（DASH）。','优质蛋白质和膳食纤维。',summary='DASH以食物模式支持低脂奶、蔬果、全谷物等，非单一成分疗效。')
ev('ht-grains',H,11,'附录1/谷薯','增加全谷物和薯类食物摄入','如咸味面包、方便面、挂面等。',summary='全谷物和薯类粗细搭配，少选加盐谷类制品。')
ev('ht-soy',H,11,'附录1/大豆','每日食用适量的大豆及其制品','少食豆豉、豆瓣酱、腐乳等。',summary='豆腐等适量，腐乳等含盐制品少选。')
ev('ht-vegetables',H,11,'附录1/蔬果','每日新鲜蔬菜摄入不少于','最好2种以上。',summary='富钾蔬菜列举菠菜、芥兰、空心菜、口蘑等。')
ev('ht-nuts',H,12,'附录1/坚果','推荐食用原味坚果','合并超重和肥胖者应注意避免脂肪摄入过多。',summary='原味坚果可选，仍需注意总能量。')
ev('ht-oils',H,12,'附录1/油脂','优先选择富含不饱和脂肪酸的菜籽油','少食用或不食用油炸和含反式脂肪酸的食品。',summary='优先含不饱和脂肪酸植物油，仍有全天用量背景。')
ev('ht-drinks',H,12,'附录1/水和饮料','不宜饮用含糖饮料','保证摄入充足水分。',summary='少选含糖饮料，推荐白水。')
ev('ht-day-sodium',H,12,'附录1/调味品','减少摄入食盐及含钠调味品','（相当于食盐5g）。',summary='每日钠限量是全天参考，不能自动三等分为每餐阈值。')
ev('ht24-salt',H24,2,'一（三）限钠与低钠盐','(三)限制钠的摄入量。','低钠盐(肾病、高钾血症除外)。',summary='2024原则补充高钾血症和肾病例外。')
ev('ht24-vegetables',H24,2,'一（四）蔬果','(四)保证新鲜蔬菜和水果摄入量。','水果摄入200g~350g。',summary='2024原则推荐蔬菜不少于500g，与2023指南数量不同，不合并成统一阈值。')
ev('ht24-alcohol',H24,2,'一（六）饮酒','(六)限制饮酒或不饮酒。','过80g.',summary='2024原则给出性别相关日/周上限；2023更鼓励戒酒，不视为安全剂量。')
ev('ht24-table',H24,3,'表1/常见食物举例','高钠食物：酱油、味精、咸菜、香肠、腐乳、泡菜、腊肉腊肠等。高钾食物：蔬菜、水果、杂豆类、菌菇类、三文鱼、鸡胸肉、马铃薯、青稞等。可能含有反式脂肪酸的食物：起酥油、氢化植物油、反复使用的油、人造奶油、甜品等。',summary='人工目视核对表1；可能含有不是确定含有。',visual=True)
ev('dm-scope',D,4,'前言/适用范围','本指南主要面向成人2型糖尿病患者','个性化食养方案。',summary='不把糖尿病笼统等同2型；1型及妊娠期需个性化方案。')
ev('dm-foods',D,7,'三（一）合理膳食','主食要定量','控制盐、糖和油的使用量。',summary='全谷物、蔬菜、奶豆等直接食物建议；水果限量。')
ev('dm-carbs',D,8,'三（三）主食与GI','主食多富含碳水化合物','糖尿病患者应该学习选择主食类食物和计量。',summary='碳水化合物是餐后血糖因素，管理种类和数量，非全部禁止。')
ev('dm-low-gi',D,8,'三（三）低GI','血糖生成指数','其中全谷物和杂豆类等低GI食物，应占主食的1/3以上。',summary='优选全谷物和低GI食物，仍需主食定量。')
ev('dm-fiber',D,9,'三（三）全谷物/膳食纤维','全谷物、杂豆类、蔬菜等富含膳食纤维','降低消化道负担。',summary='减缓餐后波动；胃肠功能弱老人须保留工艺与用量限制。')
ev('dm-carbs-not-zero',D,9,'三（三）碳水边界','碳水化合物供能比过低','及时规划调整。',summary='不能从影响血糖推出零碳水更好。')
ev('dm-alcohol',D,11,'三（五）饮酒和低血糖','饮酒会扰乱糖尿病患者的正常膳食和用药','尤其是在服用胰岛素或胰岛素促泌剂时。',summary='饮酒可导致波动和低血糖，用药情境尤其重要。')
ev('dm-seasoning',D,11,'三（五）油盐饮料','培养清淡口味','不喝含糖饮料。',summary='少油盐和含盐加工食物，不喝含糖饮料。')
ev('dm-not-drink',D,10,'三（五）生活方式','首先要控制油、盐、糖，不饮酒','控制血糖、血脂、血压在理想水平。',summary='直接不饮酒建议，不能把酒精低嘌呤当作可选理由。')
ev('dm-gi-caveat',D,14,'附录1/GI解释与限制','所有食物注意食不过量。','也能帮助维持血糖稳态。',summary='低GI过量也增负担，高GI不等于绝对禁食；GI不是成分。')
ev('dm-gi-vegetables',D,15,'附录1/表1.1蔬菜GI','芦笋、菜花、西兰花、芹菜、黄瓜、茄子、莴笋、','菠菜低',summary='表中具体蔬菜GI类别，不扩展成所有品牌做法统一GI数值。')
ev('go-scope',G,4,'前言/适用人群','本指南主要面向未合并肾功能不全','个性化食养方案。',summary='成人且未合并肾功能不全等相关合并症；非药物替代。')
ev('go-purines',G,7,'三（一）嘌呤','食物中的嘌呤可经过人体代谢生成尿酸。','有助于控制血尿酸的水平及减少痛风的发生。',summary='过高嘌呤摄入不利；食物选择仍有来源差异。')
ev('go-organs',G,7,'三（一）内脏与蛋奶','动物内脏如肝、肾、心等','可安心食用。',summary='尽量避免内脏，鸡蛋蛋白和牛奶为低嘌呤选择；非过敏许可。')
ev('go-soy',G,7,'三（一）豆制品例外','虽然大豆嘌呤含量略高于瘦肉和鱼类','可适量食用。',summary='植物利用率与加工差异；不因含嘌呤禁所有豆制品。')
ev('go-triggers',G,7,'三（一）既往诱发食物','另外，每个个体对食物的反应','既往诱发痛风发作的食物。',summary='既往诱发史需个人确认，不写公共食品禁用黑名单。')
ev('go-milk',G,8,'三（二）蔬菜和乳蛋白','建议每天多食新鲜蔬菜','或相当量的奶及奶制品。',summary='直接蔬菜和奶建议；乳蛋白促尿酸排泄。')
ev('go-fructose',G,8,'三（二）果糖和食品','果糖可诱发代谢异常','果脯蜜饯等。',summary='限制果糖较高食品和果汁，不迁移至所有含果糖食物。')
ev('go-fruit-exception',G,8,'三（二）完整水果例外','尽管水果中含有果糖','建议每天水果摄入量200～350g。',summary='完整水果和果汁区别，不能仅按果糖一律禁水果。')
ev('go-water',G,8,'三（三）饮水条件','高尿酸血症与痛风人群，在心、肾功能正常情况下','每天建议2000～3000mL。',summary='足量饮水有心肾功能条件，不作为任意人群统一水量。')
ev('go-alcohol',G,8,'三（三）饮酒','饮酒会增加高尿酸血症与痛风的风险。','患者应不饮酒。',summary='一般限酒；急性发作、控制不佳或慢性关节炎时不饮酒。')
ev('go-cooking',G,9,'三（四）烹调方式','减少油炸、煎制、卤制','尽量不喝汤。',summary='直接支持肉汆煮、少喝汤；无统一降低率。')
ev('go-preserved',G,9,'三（四）加工肉','腊制、腌制或熏制的肉类','高尿酸血症与痛风人群不宜食用。',summary='加工肉的嘌呤和盐含量依据，不等同所有鲜肉禁用。')
ev('go-purine-table',G,13,'附录1/表1-1','一般将食物按嘌呤含量分为四类','分类依据《中国营养科学全书》第2版',summary='mg/100g分类范围，不是每一食品的精确测量；形态须保留。')
ev('paper-method',P,3,'2.3–2.4/分析方法','meanof two or three experiments.',summary='HPLC测定和实验均值；总嘌呤与计算尿酸量不同列，不能混用。')
ev('paper-table1',P,4,'Table 1 / Total column','Table 1.',summary='日本样品总嘌呤mg/100g；保留豆腐加工类型与生熟、干燥形态。')
ev('paper-table2',P,5,'Table 2 / Total column','Table 2.',summary='表2蘑菇鲜干样品差异；正文与表2香蕉草莓数值顺序有不一致，疑点另记。')
ev('paper-table3',P,6,'Table 3 / Total column','Table 3.',summary='表3蔬菜样品；有部位和嫩叶差异，不作跨部位统一值。')
ev('paper-drying',P,4,'3.1/干燥样品解释','moisture evaporation',summary='干燥可提高单位质量浓度，不代表凭空生成同等总量嘌呤。')

# Keep copyrighted research prose excerpts short (under 25 quoted English words per HTML source).
ev('cook-boiling','shinoda-cooking-1982',1,'Abstract / cooking comparison','Sauteing and broiling retained most of all purine bases',summary='实验中煎烤保留多数嘌呤；肉煮制可向汁液迁移；蔬菜不必有同样降低。')
ev('cook-reabsorption','shinoda-cooking-1982',1,'Abstract / boiling limitation','eluted bases might be readsorbed in the solid',summary='汤汁煮干至小体积时，已溶出的嘌呤碱可能被固体重新吸附；不可认定全部去除。')
ev('nci-formation','nci-cooked-meats-2017',1,'Formation / high temperature','react at high temperatures',summary='肉类高温下前体反应可形成HCA；肉汁滴火的烟雾可使PAH附着；烟熏也可引入PAH。')
ev('nci-limits','nci-cooked-meats-2017',1,'Human evidence / limitations','have not established a definitive link',summary='人体流行病学未建立上述暴露与癌症的确定联系，不映射成本批三个疾病的禁食规则。')
ev('nci-reduce','nci-cooked-meats-2017',1,'Reducing formation','reduce HCA and PAH formation',summary='减少直接明火、热金属及长时高温；微波预熟缩短高温阶段可降低形成；不捏造温度和产率。')

def cond(key, *values): return dict(key=key, values=list(values))
ADULT=[cond('adult','yes')]
GOUT_SCOPE=ADULT+[cond('renalFunction','normal'),cond('complexComorbidity','no')]
DM_SCOPE=ADULT+[cond('diabetesType','type2')]
def fact(key, kind, subject, obj, predicate, keys, statement, conditions=(), quantity=None, dose=False, qualifiers=(), scope='qualitative'):
    row=dict(id='fact:'+key,version=VERSION,kind=kind,subjectId=subject,objectId=obj,predicate=predicate,
      statement=statement,conditions=list(conditions),quantity=quantity,doseDependent=dose,
      evidenceIds=[evidence_map[k]['id'] for k in keys],qualifyingEvidenceIds=[evidence_map[k]['id'] for k in qualifiers],
      sourceVersions={evidence_map[k]['sourceId']:evidence_map[k]['sourceVersion'] for k in list(keys)+list(qualifiers)},
      reviewState='source_checked',clinicalReview='pending',validFrom='2026-10-28',withdrawnAt=None,scope=scope,
      directness='project_interpretation' if key=='keep-broth-no-removal' else ('sample_measurement' if quantity and quantity['kind']=='reported_measurement' else ('guideline_classification' if quantity else 'source_statement')))
    facts.append(row)
    if kind=='food_guidance': rules.append(dict(id='rule:'+key,version=VERSION,factId=row['id'],status='draft',reviewer=None))
    return row

def effect(key,disease,component,predicate,keys,statement,conditions=ADULT,dose=False,qualifiers=()):
    return fact(key,'disease_component',disease,'c:'+component,predicate,keys,statement,conditions,dose=dose,qualifiers=qualifiers)
effect('ht-sodium',HT,'sodium','adverse',['ht-sodium','ht24-salt'],'钠盐摄入过多与血压风险相关。',dose=True)
effect('ht-potassium',HT,'potassium','beneficial_tendency',['ht-potassium','ht24-salt'],'增加膳食钾可降低血压；不等同钾药物建议。',ADULT+[cond('renalFunction','normal'),cond('hyperkalemia','no')])
effect('ht-saturated-fat',HT,'saturated-fat','adverse',['ht-fat'],'关联血脂及冠心病、脑卒中风险，不宣称直接等幅升高血压。',dose=True)
effect('ht-alcohol',HT,'ethanol','adverse',['ht-alcohol'],'过量饮酒增加高血压风险，优先不饮酒。',dose=True,qualifiers=['ht24-alcohol'])
effect('dm-carbohydrate',DM,'carbohydrate','conditional',['dm-carbs','dm-carbs-not-zero'],'种类和数量影响餐后血糖；不等同所有碳水有害或零碳水更好。',DM_SCOPE,dose=True)
effect('dm-fiber',DM,'fiber','beneficial_tendency',['dm-fiber'],'全谷物等含纤维膳食可减缓餐后波动，证据是食物组合，非单一提纯纤维疗效。',DM_SCOPE,qualifiers=['dm-gi-caveat'])
effect('dm-ethanol-effect',DM,'ethanol','adverse',['dm-alcohol'],'饮酒可导致血糖波动，使用胰岛素或促泌剂时低血糖风险尤其相关。',DM_SCOPE)
for dis,suffix in [(GO,'gout'),(HU,'hyperuricemia')]:
    effect(suffix+'-purines',dis,'purines','adverse',['go-purines'],'过高嘌呤摄入增加尿酸生成，不以食品浓度单独决定禁食。',GOUT_SCOPE,dose=True,qualifiers=['go-soy','go-fruit-exception'])
    effect(suffix+'-fructose',dis,'fructose','adverse',['go-fructose'],'高果糖食品的限制需区分完整水果。',GOUT_SCOPE,dose=True,qualifiers=['go-fruit-exception'])
    effect(suffix+'-ethanol',dis,'ethanol','adverse',['go-alcohol'],'酒精可增加尿酸生成并减少排泄；低嘌呤酒仍有酒精风险。',GOUT_SCOPE)
    effect(suffix+'-milk-protein',dis,'milk-protein','beneficial_tendency',['go-milk'],'指南支持乳蛋白促进尿酸排泄，食物建议另有直接奶类依据。',GOUT_SCOPE)

def composition(key,food,component,keys,statement,predicate='contains',quantity=None):
    return fact(key,'food_component','f:'+food,'c:'+component,predicate,keys,statement,quantity=quantity)
for food in ['salt','soy-sauce','oyster-sauce','chicken-seasoning','msg']:
    composition(food+'-sodium',food,'sodium',['ht-day-sodium'],'属于指南列举的含钠调味品；无品牌含量值。')
for food in ['pickles','sausage','fermented-bean-curd','cured-meat']:
    composition(food+'-sodium',food,'sodium',['ht24-table'],'2024表1列举的高钠食物，无品牌定量。')
for food in ['spinach','chinese-kale','water-spinach','button-mushroom-fresh']:
    composition(food+'-potassium',food,'potassium',['ht-vegetables'],'指南列举的富钾蔬菜；未给出精确含量。')
for food in ['whole-grains','pulses','fresh-vegetables']:
    composition(food+'-fiber',food,'fiber',['dm-fiber'],'指南列举的膳食纤维来源，不作全部同量。')
for food in ['whole-grains','pulses']:
    composition(food+'-carbs',food,'carbohydrate',['dm-foods'],'碳水化合物来源之一，具体量未列入本数据。')
for food in ['sweet-drinks','juice','fructose-syrup','preserved-fruit']:
    composition(food+'-fructose',food,'fructose',['go-fructose'],'指南列举的果糖较高食品类别，具体配方因品牌变化。')
composition('fruit-fructose','fresh-fruit','fructose',['go-fruit-exception'],'水果含果糖，但不据此推导水果统一禁用。')
composition('milk-protein','milk','milk-protein',['go-milk'],'奶类含乳蛋白，过敏和其他限制另行核验。')
composition('alcohol-ethanol','alcohol','ethanol',['go-alcohol'],'含酒精饮品的乙醇风险不能由低嘌呤抵消。')
for food in ['canola-oil','flax-oil','olive-oil','sunflower-oil','corn-oil']:
    composition(food+'-unsaturated-fat',food,'unsaturated-fat',['ht-oils'],'指南列举的富不饱和脂肪酸油类；仍限制总油量。')
for food in ['shortening','hydrogenated-oil','reused-oil','margarine']:
    composition(food+'-trans-fat',food,'trans-fat',['ht24-table'],'表1为可能含有，不能推断任何品牌均检出。','may_contain')

# These are guideline concentration categories, NOT measured point values.
for group, foods, lower, upper in [
 ('high',['liver','kidney','nori-dry','mussel','oyster','squid'],150,1000),
 ('moderately-high',['beef','pork','lamb','duck'],75,150),
 ('moderately-low',['rice-unspecified','oats','buckwheat','green-bean','cauliflower','shiitake-fresh','enoki-fresh','button-mushroom-fresh'],30,75),
 ('low',['potato','sweet-potato','carrot','rape','lettuce','fresh-fruit','milk'],None,30),
]:
    for food in foods:
        q=dict(kind='classification_range',value=None,lower=lower,upper=upper,upperExclusive=group=='low',unit='mg',basisAmount=100,basisUnit='g',category=group,method='Guideline Table 1-1; secondary classification, not a sample measurement')
        composition('nhc-purine-'+food,food,'purines',['go-purine-table'],'指南嘌呤分类范围；不取中点、不转为每餐限量，不据此自动禁止食物。',quantity=q)

# Preserve the Total column rather than the adjacent calculated uric acid column.
for food,value,key,label in [
 ('rice-polished-dry',25.9,'paper-table1','Rice (polished)'),('rice-brown-dry',37.4,'paper-table1','Rice (unpolished)'),
 ('soybean-dry',172.5,'paper-table1','Soybean (dried)'),('soymilk-sample',22.0,'paper-table1','Soymilk'),
 ('tofu-kinu',20.0,'paper-table1','Tofu (Kinu)'),('tofu-momen-chilled',31.1,'paper-table1','Tofu (Momen, chilled)'),
 ('tofu-momen-boiled',21.9,'paper-table1','Tofu (Momen, 3 min boiled)'),
 ('shiitake-fresh',20.8,'paper-table2','Shiitake (raw)'),('shiitake-dry',379.5,'paper-table2','Shiitake (dried)'),
 ('carrot',2.2,'paper-table3','Carrot'),('potato',6.5,'paper-table3','Potato'),
 ('cucumber',9.4,'paper-table3','Cucumber'),('cabbage',3.2,'paper-table3','Cabbage'),('broccoli',70.0,'paper-table3','Broccoli'),
]:
    q=dict(kind='reported_measurement',value=value,lower=None,upper=None,upperExclusive=False,unit='mg',basisAmount=100,basisUnit='g',category=None,method='HPLC; Japan supermarket samples; mean of two or three experiments; no generalization to all cultivars/brands',sourceFoodLabel=label)
    composition('kaneko-purine-'+food,food,'purines',[key,'paper-method'],'论文样品的总嘌呤测定值；不同地区、品种、含水量和形态不可无条件套用。',quantity=q)

def guidance(key,dis,food,action,keys,statement,conditions=ADULT,qualifiers=()):
    return fact(key,'food_guidance',dis,('p:' if food.startswith('@') else 'f:')+food.lstrip('@'),action,keys,statement,conditions,qualifiers=qualifiers)
for food,key in [('fresh-vegetables','ht-fiber-food'),('fresh-fruit','ht-fiber-food'),('whole-grains','ht-grains'),('tofu','ht-soy'),('low-fat-milk','ht-dash')]:
    guidance('ht-prefer-'+food,HT,food,'prefer',[key],'膳食模式下可优先选择，仍需个人适用性及过敏核验。')
guidance('ht-nuts',HT,'nuts-unsalted','prefer',['ht-nuts'],'可选原味坚果，须保留总能量和超重肥胖条件。',ADULT+[cond('energyPlanCompatible','yes')])
for food,key in [('salt','ht-day-sodium'),('soy-sauce','ht-day-sodium'),('oyster-sauce','ht-day-sodium'),('fermented-bean-curd','ht-soy'),('bacon','ht-fat'),('sausage','ht-fat'),('sweet-drinks','ht-drinks'),('alcohol','ht-alcohol')]:
    guidance('ht-limit-'+food,HT,food,'limit',[key],'指南支持少选或不选；此定性规则不自行生成每餐克数。')
for food in ['whole-grains','pulses','fresh-vegetables','tofu']:
    guidance('dm-prefer-'+food,DM,food,'prefer',['dm-foods','dm-low-gi'],'合理膳食内优选，主食数量与个体血糖反应仍需管理。',DM_SCOPE,qualifiers=['dm-gi-caveat'])
guidance('dm-fruit',DM,'fresh-fruit','limit',['dm-foods'],'完整水果限量而非一律禁食；具体量依个人方案。',DM_SCOPE)
guidance('dm-sweet-drinks',DM,'sweet-drinks','avoid',['dm-seasoning'],'指南明确不喝含糖饮料；不覆盖低血糖急救等特殊医疗情境。',DM_SCOPE+[cond('hypoglycemiaRescue','no')])
guidance('dm-alcohol',DM,'alcohol','avoid',['dm-not-drink','dm-alcohol'],'日常饮食不饮酒，尤其注意用药相关低血糖风险。',DM_SCOPE)
for food in ['salt','soy-sauce','pickles']:
    guidance('dm-limit-'+food,DM,food,'limit',['dm-seasoning'],'限制高盐调味品或食物，保留全天管理范围。',DM_SCOPE)
for dis,suffix in [(GO,'gout'),(HU,'hyperuricemia')]:
    for food,key in [('milk','go-milk'),('egg-white','go-organs'),('fresh-vegetables','go-milk')]:
        guidance(suffix+'-prefer-'+food,dis,food,'prefer',[key],'指南有直接食物层面支持，仍核对个体限制。',GOUT_SCOPE)
    guidance(suffix+'-tofu',dis,'tofu','insufficient_evidence',['go-soy'],'指南支持豆制品可适量食用，不支持仅据此赋予优先有益加分；也不能因含嘌呤统一禁止。',GOUT_SCOPE)
    for food in ['liver','kidney']:
        guidance(suffix+'-avoid-'+food,dis,food,'avoid',['go-organs'],'指南尽量避免选择动物内脏，不靠浓度阈值推导。',GOUT_SCOPE)
    for food in ['sweet-drinks','juice','fructose-syrup','preserved-fruit']:
        guidance(suffix+'-limit-'+food,dis,food,'limit',['go-fructose'],'限制果糖较高食品，不能扩大为禁止完整水果。',GOUT_SCOPE,qualifiers=['go-fruit-exception'])
    guidance(suffix+'-fruit',dis,'fresh-fruit','prefer',['go-fruit-exception'],'完整水果可纳入推荐摄入范围，仍为适量，不套用果汁限制。',GOUT_SCOPE)
    guidance(suffix+'-alcohol',dis,'alcohol','limit',['go-alcohol'],'通常限制饮酒；明确避酒条件应优先覆盖本条。',GOUT_SCOPE)
    guidance(suffix+'-alcohol-avoid',dis,'alcohol','avoid',['go-alcohol'],'急性痛风发作、药物控制不佳或慢性痛风性关节炎任一时不饮酒。',GOUT_SCOPE+[cond('goutAlcoholAvoidanceContext','acute_attack','poor_control','chronic_gouty_arthritis')])
    guidance(suffix+'-boil-discard',dis,'@boil-discard','prefer',['go-cooking'],'肉类汆煮后食用、尽量不喝汤；不保证全去嘌呤。',GOUT_SCOPE)
    guidance(suffix+'-broth',dis,'stew-broth','limit',['go-cooking'],'尽量不喝烹肉汤，不与肉块降低混为一体。',GOUT_SCOPE)
    guidance(suffix+'-frying',dis,'@fry','limit',['go-cooking'],'指南建议减少煎炸方式，不推导任一煎制必然造成疾病。',GOUT_SCOPE)
    guidance(suffix+'-cured-meat',dis,'cured-meat','avoid',['go-preserved'],'指南列举腊腌熏肉不宜食用；不扩展到所有鲜肉。',GOUT_SCOPE)

def cooking(key,process,component,predicate,keys,statement,conditions):
    return fact(key,'cooking_effect','p:'+process,'c:'+component,predicate,keys,statement,conditions,scope='process_evidence_only_not_disease_rule')
cooking('boil-purine-migration','boil-discard','purines','may_transfer',['cook-boiling','go-cooking'],'所研究肉类嘌呤可向煮液迁移；弃汤和喝汤须分别判断。',[cond('inputFoodClass','muscle_meat'),cond('medium','water'),cond('brothDisposition','discarded')])
cooking('keep-broth-no-removal','boil-keep','purines','insufficient_evidence',['cook-boiling'],'连汤食用不能把肉块减少量当整餐摄入减少量。',[cond('inputFoodClass','muscle_meat'),cond('brothDisposition','consumed')])
cooking('reduce-reabsorption','reduce-broth','purines','may_redistribute',['cook-reabsorption'],'研究提示汤汁收浓可发生再吸附；无统一温度时间或比例。',[cond('medium','water'),cond('brothReduced','yes')])
cooking('fry-purines-retained','fry','purines','mostly_retained',['cook-boiling'],'该实验煎烤保留多数嘌呤，不把煎烤视为可靠去嘌呤法。',[cond('inputFoodClass','study_foods')])
cooking('soy-processing-purines','soy-processing','purines','may_decrease',['go-soy'],'指南报告豆腐等加工后嘌呤降低；不把所有大豆制品设为同一数值。',[cond('outputFoodClass','tofu_or_dried_tofu')])
cooking('high-heat-hca','high-heat-meat','hca','may_form',['nci-formation'],'肉类高温前体反应可形成HCA；不外推为高血压糖尿病痛风禁食。',[cond('inputFoodClass','muscle_meat'),cond('highHeat','yes')])
cooking('flame-pah','flame-smoke','pah','may_deposit',['nci-formation'],'滴落肉汁引起明火烟雾，PAH可附着肉表面；形成条件须实证。',[cond('inputFoodClass','muscle_meat'),cond('drippingFlameSmoke','yes')])
cooking('smoking-pah','smoke-meat','pah','may_deposit',['nci-formation'],'烟熏肉可引入PAH，未给定含量及疾病结论。',[cond('inputFoodClass','muscle_meat'),cond('smokeExposure','yes')])
cooking('microwave-hca','microwave-preheat','hca','may_decrease',['nci-reduce'],'预熟缩短后续高温暴露可减少形成；不是所有微波操作都满足条件。',[cond('inputFoodClass','muscle_meat'),cond('subsequentHighHeatShortened','yes')])

conflicts.extend([
 dict(id='conflict:shiitake',kind='source_variation',factIds=['fact:nhc-purine-shiitake-fresh','fact:kaneko-purine-shiitake-fresh'],resolution='retain_both_do_not_average',note='指南将鲜香菇列30–75 mg/100g，论文特定样品20.8 mg/100g；不同来源方法与样品不可合并，不据浓度自动禁食。'),
 dict(id='conflict:vegetable-amount',kind='guideline_difference',evidenceIds=[evidence_map[k]['id'] for k in ['ht-vegetables','ht24-vegetables']],resolution='qualitative_only',note='2023至少300g与2024至少500g保留版本；本批定性推荐不自动使用日量阈值。'),
 dict(id='conflict:alcohol',kind='recommendation_strength_difference',evidenceIds=[evidence_map[k]['id'] for k in ['ht-alcohol','ht24-alcohol']],resolution='no_safe_intake_claim',note='保留2023尽量不饮与2024日周限量，不把上限解释成安全量或自行平均。'),
 dict(id='conflict:banana-strawberry',kind='within_source_inconsistency',sourceId=P,resolution='excluded_values',note='论文3.3正文与表2的香蕉和草莓值顺序相反；本批不导入二者数值，待勘误核验。'),
])

bundle=dict(schemaVersion='1.0.0',id='health-kb-'+VERSION,status='research_ready',clinicalRelease=None,
  createdDate='2026-10-28',sources=sources,entities=entities,evidence=evidence,facts=facts,ruleDrafts=rules,
  conflicts=conflicts,revocations=[],recipeBindings=[],
  boundaries=dict(personalDataIncluded=False,embeddingBuilt=False,onlineEnabled=False,
    genericDiabetesRequiresTypeConfirmation=True,unsupportedCombinations='No clinical disease combination release',
    recipeMapping='No binding until bundle ID/hash, recipeId, variantId and methodId are verified',
    fullTextRedistribution=False,quantitativeNutritionTotals=False))

if errors:
    raise ValueError('\n'.join(errors))

def write_json(name, value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
write_json('knowledge-bundle.json',bundle)
for name,rows in [('sources',sources),('entities',entities),('evidence',evidence),('facts',facts),('rule-drafts',rules),('conflicts',conflicts)]:
    (OUT/(name+'.jsonl')).write_text(''.join(json.dumps(row,ensure_ascii=False,separators=(',',':'))+'\n' for row in rows),encoding='utf-8')
with (OUT/'relations.csv').open('w',encoding='utf-8-sig',newline='') as stream:
    writer=csv.writer(stream)
    writer.writerow(['id','kind','subject_id','subject_name','predicate','object_id','object_name','conditions_json','quantity_json','evidence_ids_json','statement','review_state','clinical_review'])
    for f in facts:
        writer.writerow([f['id'],f['kind'],f['subjectId'],entity_map[f['subjectId']]['name'],f['predicate'],f['objectId'],entity_map[f['objectId']]['name'],json.dumps(f['conditions'],ensure_ascii=False),json.dumps(f['quantity'],ensure_ascii=False),json.dumps(f['evidenceIds']),f['statement'],f['reviewState'],f['clinicalReview']])
manifest=dict(id=bundle['id'],schemaVersion='1.0.0',status='research_ready',createdDate='2026-10-28',
    files={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.iterdir()) if p.suffix in ('.json','.jsonl','.csv') and p.name!='manifest.json'},
    counts={k:len(bundle[k]) for k in ['sources','entities','evidence','facts','ruleDrafts','conflicts','recipeBindings']},
    index=dict(kind='structured_plus_controlled_keywords',version='lexical-v1',embedding=None,reranker=None),
    clinicalRelease=None)
write_json('manifest.json',manifest)
print(json.dumps(manifest['counts'],ensure_ascii=False))
