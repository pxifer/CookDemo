"""Source-checked explanation candidate; never invent patient portions or publish executable rules."""
from pathlib import Path
from argparse import ArgumentParser
import hashlib, importlib.util, json
from importlib.metadata import version

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('parser',ROOT/'scripts/lib/document-parser.py')
parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)
VERSION='thyroid-iodine-explanation-2026-11-13-v1'
SOURCES=[
 ('niddk-hypothyroidism-20261113.html','niddk-hypothyroidism','Hypothyroidism (Underactive Thyroid)','https://www.niddk.nih.gov/health-information/endocrine-diseases/hypothyroidism','6f1ca80d48f3643f73c096ee4d50f5689cdea82f7fe83cc78d0773aecfb7c401','NIH/NIDDK public health information; attribution; no images or full HTML redistributed.'),
 ('niddk-hashimoto-20261113.html','niddk-hashimoto',"Hashimoto’s Disease",'https://www.niddk.nih.gov/health-information/endocrine-diseases/hashimotos-disease','a6bf012436b1cd01a28eef7ca453271b109ecf0f3854e3499fe0078768856ab2','NIH/NIDDK public health information; attribution; no images or full HTML redistributed.'),
 ('hk-cfs-iodine-food-2025.html','hk-cfs-iodine-2025','Iodine in Food — Report No.77','https://www.cfs.gov.hk/english/programme/programme_rafs/programme_rafs_n_01_34_Iodine_in_Food_2025_report77.html','f85f23e21692c0be8e5fe562c9144955787ee31227ca91a7370c90425e35e3c2','Background/public-advice sentences only, acknowledged to CFS/FEHD. No research measurements, datasets, figures or tables reproduced; research-data reuse permission is not claimed.')]

def encoded(value):return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()

def build(cache,output):
 cache,output=Path(cache).resolve(),Path(output).resolve()
 if output!=ROOT/'datasets/health'/VERSION and not output.is_relative_to(ROOT/'.local-data'):raise ValueError('NEW_VERSION_OR_PRIVATE_OUTPUT_REQUIRED')
 if {name:version(name) for name in parser.VERSIONS}!=parser.VERSIONS:raise ValueError('LOCKED_PARSER_REQUIRED')
 sources=[];documents={};evidence=[]
 for file,key,title,url,expected,license_text in SOURCES:
  raw=(cache/file).read_bytes()
  if parser.sha(raw)!=expected:raise ValueError('SOURCE_HASH_CHANGED')
  document=parser.html_document(raw);enhanced=parser.enhance(document);documents[key]=(document,enhanced)
  sources.append(dict(id=key,title=title,url=url,retrievedDate='2026-11-13',sourceHash=expected,license=license_text))
 def excerpt(key,prefix,source_id,sentence=None):
  document,enhanced=documents[source_id];atoms={a['id']:a for a in document['rawAtoms']}
  hits=[]
  for row in enhanced['ranges']:
   text=enhanced['text'][row['start']:row['end']];origin=[atoms[x] for x in row.get('sourceAtomIds',[])]
   if text.startswith(prefix) and origin and all(a['inBody'] and a['role']=='body' for a in origin):hits.append((row,text,origin))
  if len(hits)!=1:raise ValueError('EXPLANATION_BODY_NOT_UNIQUE:'+key)
  row,text,origin=hits[0];span=sentence or text
  if text.count(span)!=1:raise ValueError('EXPLANATION_SENTENCE_NOT_UNIQUE')
  start=row['start']+text.index(span);source=next(s for s in sources if s['id']==source_id)
  item=dict(id='topic-ev:'+parser.sha((source['sourceHash']+'\0'+key+'\0'+span).encode()),key=key,sourceId=source_id,sourceHash=source['sourceHash'],originalSpan=span,spanHash=parser.sha(span.encode()),locator=dict(normalization=parser.POLICY+'-enhanced-blocks',start=start,end=start+len(span),parentStart=row['start'],parentEnd=row['end'],parentHash=parser.sha(text.encode()),bodyLocator=document['bodyLocator'],atoms=[dict(id=a['id'],locator=a['locator'],blockKey=a['blockKey']) for a in origin]),extraction='complete_sentence_with_body_parent' if sentence else 'complete_unique_body_block',verification='project_source_recheck_not_independent_clinical_review')
  evidence.append(item);return item['id']
 risk=excerpt('autoimmune-seaweed','Your thyroid uses iodine','niddk-hypothyroidism')
 pregnancy=excerpt('pregnancy-qualifier','However, if you are pregnant','niddk-hashimoto')
 supplements=excerpt('selenium-not-established','Researchers are looking at other ways','niddk-hashimoto')
 variable=excerpt('species-variability','9. The earth’s soils','hk-cfs-iodine-2025','However, the iodine content of seaweed varies with different species; it is generally greater in brown seaweeds (kelps) than the green or red varieties.')
 foods=excerpt('food-source-context','During food preparation','hk-cfs-iodine-2025','Examples of iodine-rich foods or ingredients are seafood (e.g., seaweed or kelp, marine fish, crustaceans, molluscs), eggs, dairy, and their products.')
 individual=excerpt('thyroid-individual-qualifier','Persons with existing medical conditions','hk-cfs-iodine-2025')
 facts=[
  dict(id='thyroid-autoimmune-seaweed',section='能否吃',statement='不能只凭“甲减”一律判定能吃或禁吃海带。若属于桥本等自身免疫性甲状腺病，大量高碘海藻或自行补碘可能造成不利影响；应先确认病因和医生给出的限碘要求。',evidenceIds=[risk],qualifyingEvidenceIds=[individual],conditions=['仅描述自身免疫性甲状腺病的高碘风险，不推断所有甲减均缺碘或均需低碘'],kind='conditional_explanation'),
  dict(id='thyroid-food-source-context',section='食材选择',statement='鱼虾、蛋类和奶类也属于含碘食物来源，不必把补碘等同于必须吃海带。这里是食物来源信息，不是甲减宜吃清单；是否适合或需要限制，应结合病因、过敏和个体饮食方案。',evidenceIds=[foods],qualifyingEvidenceIds=[individual,risk],conditions=['公共食物来源知识，不能转成甲减患者应增加摄入的指令'],kind='food_source_context_only'),
  dict(id='thyroid-pregnancy-qualifier',section='特殊条件',statement='妊娠期既要考虑足够的碘，也不能过量；不能把普通甲减或海带限量建议直接套用，应由医生明确个人碘需要。',evidenceIds=[pregnancy],qualifyingEvidenceIds=[],conditions=['妊娠相关限定，不据此开补充剂或营养处方'],kind='exception'),
  dict(id='thyroid-supplement-boundary',section='补充剂',statement='不能把正在研究的硒或维生素D补充推成桥本患者已有明确适用方案，不给出自行补充剂量。',evidenceIds=[supplements],qualifyingEvidenceIds=[],conditions=['来源未给特定方案，不声称其他后续指南也均无方案'],kind='evidence_limit')]
 limitations=[
  dict(id='thyroid-frequency-not-established',section='频率',statement='本批核验资料未提供适用于你的海带每周次数，不能据此把“每周几次”作为个人安全承诺。',evidenceIds=[risk,individual],origin='project_source_coverage_limit',patientFrequencyPerWeek=None),
  dict(id='thyroid-portion-not-established',section='量',statement='海藻含碘量随品种而变化；缺少具体产品含碘量与个人目标，不能把通用碘摄入参考换算成你的海带克数。当前没有可核验的个人份量。',evidenceIds=[variable,individual],origin='project_source_coverage_limit',patientPortionGrams=None,conversionAllowed=False)]
 data=dict(id=VERSION,status='local_research_explanation_candidate',clinicalRelease=None,professionalReview='pending',topic=dict(id='topic:thyroid-iodine',conditionAliases=['甲减','甲状腺功能减退','甲状腺功能减退症','桥本','桥本甲状腺炎'],foodAliases=['海带','海藻','紫菜','海苔'],scope='Iodine/seaweed explanation only; not comprehensive hypothyroidism treatment or executable food exclusion'),sources=sources,evidence=evidence,facts=facts,limitations=limitations,followup='你的甲减病因是否已明确为桥本等自身免疫性疾病？',boundaries=dict(newExecutableRules=False,newVectors=False,pgImported=False,personalDataIncluded=False,generalPopulationSourcesNotPatientPrescription=True))
 payload=encoded(data);manifest=encoded(dict(id=VERSION,files={'knowledge.json':parser.sha(payload)},counts=dict(sources=len(sources),evidence=len(evidence),facts=len(facts),limitations=len(limitations)),parserPolicy=parser.POLICY,parserCodeHash=parser.sha((ROOT/'scripts/lib/document-parser.py').read_bytes()),dependencies=parser.VERSIONS,clinicalRelease=None))
 output.mkdir(parents=True,exist_ok=True)
 for name,value in [('knowledge.json',payload),('manifest.json',manifest)]:
  path=output/name
  if path.exists() and path.read_bytes()!=value:raise ValueError('FROZEN_EXPLANATION_CHANGED_USE_NEW_VERSION')
  if not path.exists():
   with path.open('xb') as file:file.write(value)
 return json.loads(manifest)

if __name__=='__main__':
 cli=ArgumentParser();cli.add_argument('--cache',type=Path,required=True);cli.add_argument('--output',type=Path,default=ROOT/'datasets/health'/VERSION);args=cli.parse_args();print(json.dumps(build(args.cache,args.output),ensure_ascii=False))
