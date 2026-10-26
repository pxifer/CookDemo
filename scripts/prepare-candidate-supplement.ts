// Reconstruct a local candidate-only supplement from fixed source snapshots, verified by Git blob SHA.
// This command never connects to a database or imports calorie/health introductions.
import { readFile,readdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const commit='0e106eea348c734fe1586f781202994439cf98a5';
const specs=[
  {id:'R411',name:'宫保鸡丁',category:'meat',flavor:'糊辣酸甜',sha:'2aeba3a2514b49a4313f14dda0f3d88cb5b52e40',
    main:['鸡腿或鸡胸肉1支（约350g）'],aux:['大葱1根（约180g）','熟花生150g','姜片10g','莴笋约250g（进阶参考可选）'],
    seasonings:['干辣椒10g，或二荆条约4支','生抽10g','白糖2g','盐2g','植物油20g','腌制淀粉15g','料酒15g','老抽5g','花椒5g','香醋5g','鸡精2g','芝麻油10g','勾芡淀粉10g','豆瓣酱10g（进阶参考）','油泼辣子5g（进阶参考可选）','葱姜水及勾芡水见步骤'],
    notes:['两种同口味方法保留参考，进阶所用莴笋、生花生与简易版不同，不作为正式受控变体。','原料表的生抽未在简易步骤明确使用；量与步骤仍待核。']},
  {id:'R412',name:'麻婆豆腐',category:'meat',flavor:'咸鲜微辣',sha:'202fdaa3ebccf73b0d420d32c5440aed26e19e02',
    main:['内酯豆腐1盒','咸鸭蛋1枚（原方只取蛋白）','五花肉20～30g'],aux:['大蒜2瓣','生姜2片','小米辣5根'],
    seasonings:['蒜蓉辣酱5g','花椒20颗','盐3g','酱油10g','食用油10～15ml（步骤给出）','开水至没过豆腐（未定量）'],
    notes:['这是咸鸭蛋白参与的社区版本，不等于传统豆瓣酱麻婆豆腐。','必备清单的香辣酱与计算清单的蒜蓉辣酱命名不一致，待核；复合调料成分未知。']},
  {id:'R413',name:'回锅肉',category:'meat',flavor:'豆瓣咸鲜微辣',sha:'90414f1f719a9278a85e188d8668497ca4c5ea5d',
    main:['五花肉或二刀肉（定量待核，原文按性别估量方式不采纳）'],aux:['小葱2棵','生姜10～40g','青红椒0～30g（原文按受辣程度选用）','蒜苗1把'],
    seasonings:['料酒5ml','豆瓣酱10ml','味精5g','生抽5ml','滑锅底油（未定量）','煮肉用水（未定量）'],
    notes:['按性别估量不进入本项目人数／份量规则，保留未知用量。','先煮后炒与简易生炒是同味做法参考，二选一，尚未实做；原文炙皮操作需复核。']},
  {id:'R414',name:'手撕包菜',category:'meat',flavor:'酸辣',sha:'32b3dd4915b946994ba5275c3deece4fce339d0d',
    main:['包菜1颗','五花肉200g'],aux:['小米辣2根','姜2片','蒜头2粒','蒜苗半根'],
    seasonings:['食用油60ml','料酒5ml','生抽5ml','香醋5ml','鸡精2g','盐5g（原文清洗2g、炒菜3g）'],
    notes:['此版本含五花肉，不作素食展示。','末步料酒重复出现、生抽未交代使用位置；保留待核，不自行补工序或重复加酒。']},
  {id:'R415',name:'韭菜炒蛋',category:'veg',flavor:'咸鲜',sha:'841c8e104317f48a7deb5daacc87841099f1c710',
    main:['韭菜100g（原文每份）','鸡蛋2个（原文每份）'],aux:[],seasonings:['食用油10ml（原文每份，步骤另加5ml）','盐2g（原文每份）'],
    notes:['配料表油10ml与步骤另加5ml的总量关系未明确；候选不自动按人数缩放。']},
  {id:'R416',name:'葱煎豆腐',category:'veg',flavor:'葱香微辣',sha:'17bf935f916ec6fe045de83d4e5b1124a86f4116',
    main:['白豆腐（原文份数×0.8向上取整；单块重量未知）'],aux:['青辣椒1.5只／三份（原文参考）','葱2根／三份（原文参考）'],
    seasonings:['盐3g／原文每份','鸡精1.5g／原文每份','首轮油9ml／原文每份，之后补油未定量','水10ml（步骤给出）'],
    notes:['保留原文计量表达，不把块数或人数比例当成已经核定的标准克重，不自动缩放。']},
  {id:'R417',name:'凉拌黄瓜',category:'veg',flavor:'醋香咸鲜',sha:'2c16a64c5bd977ff3dafcd6079b816586f207f7f',
    main:['黄瓜200g／原文每份'],aux:['大蒜3瓣／原文每份'],
    seasonings:['醋7.5ml＋4ml×份数（原文表达）','酱油5ml＋2.5ml×份数（原文表达）','盐0.4g＋0.2g×份数（原文表达）','香油5ml＋2ml×份数（原文表达）','蚝油5ml','白糖5g（步骤给出）'],
    notes:['原方使用混合固定量与按份数计量，未转成固定标准配方；候选不自动缩放。']},
  {id:'R418',name:'洋葱炒鸡蛋',category:'veg',flavor:'葱香咸鲜',sha:'4c62abfc66f4f2188f82ada2cd045a1a88d1fedd',
    main:['鸡蛋2个','洋葱50g'],aux:['葱半根'],seasonings:['食用油50ml','盐2g','料酒2ml'],notes:['来源文字及用量可追溯，尚未试做或专业审核。']},
];
const directory='.local-data/recipe-research-v3/howtocook-text';
const cache=await Promise.all((await readdir(directory)).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await readFile(`${directory}/${f}`,'utf8'))));
const clean=(s:string)=>s.replace(/\*\*|`/g,'').replace(/【参见图[一二三四]】/g,'').trim();
const numbered=(s:string)=>s.split(/\r?\n/).flatMap(line=>{const m=line.match(/^\s*\d+\.\s+(.+)/);return m?[clean(m[1])]:[];});
const cards=specs.map(spec=>{
  const source=cache.find(c=>c.name===spec.name&&c.commit===commit);
  if(!source)throw Error('SUPPLEMENT_SOURCE_MISSING');
  const bytes=Buffer.from(source.text,'utf8');
  const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if(blob!==spec.sha||/https?:\/\/(?!github\.com|raw\.githubusercontent\.com)/.test(source.text))throw Error('SUPPLEMENT_SOURCE_PROOF_REJECTED');
  const operation=source.text.split('## 操作')[1]?.split('## 附加内容')[0];
  if(!operation)throw Error('SUPPLEMENT_STEPS_MISSING');
  let steps=numbered(operation),method_options:{label:string;steps:string[]}[]|undefined;
  if(spec.id==='R411'){
    const simple=operation.split('### 简易版本')[1]?.split('### 稍加复杂')[0];
    const advanced=operation.split('### 稍加复杂但是更加令人垂涎欲滴的版本')[1];
    if(!simple||!advanced)throw Error('SUPPLEMENT_METHOD_MISSING');
    method_options=[{label:'简易版（原文名称）',steps:numbered(simple)},{label:'进阶版（原文名称）',steps:numbered(advanced)}];steps=[];
  }
  if(spec.id==='R413'){
    const [normal,simple]=operation.split('### 简易版本');if(!simple)throw Error('SUPPLEMENT_METHOD_MISSING');
    method_options=[{label:'先煮后炒',steps:numbered(normal)},{label:'简易生炒（待核）',steps:numbered(simple)}];steps=[];
  }
  if(!steps.length&&!method_options?.every(m=>m.steps.length))throw Error('SUPPLEMENT_STEPS_MISSING');
  return {id:spec.id,dish_key:spec.name,name:spec.name,category:spec.category,flavor:spec.flavor,level:'B',
    source:'howtocook',commit,author:'HowToCook 社区原文',url:source.url,source_blob_sha:spec.sha,source_text_sha256:createHash('sha256').update(bytes).digest('hex'),
    completeness:'source_text_pending_review',review_state:'pending_review',main:spec.main,aux:spec.aux,seasonings:spec.seasonings,steps,
    ...(method_options?{method_options}:{}),review_notes:spec.notes,note:'来源及许可核对，仅候选；不导入简介功效、估算热量或自动缩放规则。'};
});
await writeFile('docs/data/recipe-candidates-supplement-v1.jsonl',cards.map(c=>JSON.stringify(c)).join('\n')+'\n');
const text=['# 社区原方候选增补','',
  '固定提交0e106eea348c734fe1586f781202994439cf98a5，The Unlicense；8份原文经GitHub原页blob SHA核对，仍全部待审核。只供本地候选图鉴，不进入推荐；健康简介和估算热量未收录。已有菜名只增加来源版本，不重复计新菜。', '',
  '[固定许可证](https://github.com/Anduin2017/HowToCook/blob/0e106eea348c734fe1586f781202994439cf98a5/LICENSE) · [仓库所有者使用说明](https://github.com/Anduin2017/HowToCook/issues/1468#issuecomment-2811737432) · [结构化候选及来源指纹](../data/recipe-candidates-supplement-v1.jsonl)','',
  '原方份数表达保留供核查，不影响本项目已经确认的固定整道用量与人数规则。皮蛋豆腐因显式引用第三方爱料理配方而暂缓，不据仓库许可证自动收录。','',
  ...cards.flatMap(c=>[`<a id="${c.id.toLowerCase()}"></a>`,`## ${c.id} ${c.name} · ${c.flavor}`,'',`[固定来源](${c.url})`,'',
    '主料：'+c.main.join('；'),'辅料：'+(c.aux.join('；')||'无'),'调料：'+c.seasonings.join('；'),'',
    ...c.steps.map((s,i)=>`${i+1}. ${s}`),
    ...(c.method_options??[]).flatMap(m=>['',`### 同味做法参考：${m.label}`,...m.steps.map((s,i)=>`${i+1}. ${s}`)]),
    '',...c.review_notes.map(n=>`- 待核：${n}`),'']),
];
await writeFile('docs/recipes/community-supplement-v1.md',text.join('\n'));
console.log(JSON.stringify({candidates:cards.length,formalImports:0,databaseWrites:0,sourceBlobsVerified:true,excludedThirdParty:['皮蛋豆腐']}));
