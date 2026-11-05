// File-only review aid; no network, database writes, publication or automatic ingredient changes.
import { readFile,writeFile } from 'node:fs/promises';
import { curateCandidate,type CandidateCard } from './lib/candidate-curation';
const original=(await readFile('datasets/recipes/curation/recipe-cards-v3.jsonl','utf8')).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
const supplement=(await readFile('datasets/recipes/curation/recipe-candidates-supplement-v1.jsonl','utf8')).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
const cards=[...original.filter(c=>c.source==='howtocook'),...supplement] as CandidateCard[];
const manual:Record<string,string[]>={
  R271:['主料表列可选鸡蛋，但卡片步骤没有使用鸡蛋的路线；不自行补入。'],
  R294:['表中盐3g，步骤另有浸泡2g及末步3g；末步“3g”后缺配料名，需核固定原文，不猜为鸡精。'],
  R300:['原料表有牛肉高汤500ml，步骤写加水未交代高汤使用位置；不自动用高汤替换水。'],
  R296:['黄豆酱在原料表为5g、步骤为5ml；不作密度换算或选定其一。'],
  R298:['冬瓜片原文尺寸与卷制动作不自洽，需核原方。'],
  R302:['原料表有生抽20ml，原文步骤未交代使用位置，不擅自补入。'],
  R323:['生蚝酱油用量表述每个1ml、步骤每个5ml，需核方。'],
  R310:['切法中45度间隔、16刀及后续补8刀的瓣数表述需核；不将其默认为已验证操作。'],
  R350:['生抽在原料表6ml、调汁步骤10ml；调好的碗汁何时入锅未明确。'],
  R396:['萝卜最初切条腌制，后续清洗、加热及合拌未明确。'],
};
const results=cards.map(card=>{
  const curation=curateCandidate(card),view=curation?.record??card;
  const lines=['main','aux','seasonings'].flatMap(field=>(view[field] as string[]??[]).map(text=>({field,text})));
  const fragments=lines.filter(l=>/^(切末|切碎|拍碎|剁碎|切片|去皮|洗净|沥干|备用|适量|少许|\d+(?:\.\d+)?\s*(?:个|克|g|ml|毫升|瓣|根))$/.test(l.text.trim()));
  const stepInferred=lines.filter(l=>l.text.includes('步骤另提及，未单列固定用量'));
  return {id:card.id,name:card.dish_key,source:card.url,state:'pending_review',curated:!!curation,fragments,stepInferred,manual:manual[card.id]??[]};
});
const report={checkedAt:new Date().toISOString(),sourceCount:cards.length,sourceUnchanged:true,publications:0,
  supplementalCards:supplement.length,
  curated:results.filter(r=>r.curated).length,fragmentCards:results.filter(r=>r.fragments.length).length,
  stepInferredCards:results.filter(r=>r.stepInferred.length).length,manualReviewCards:Object.keys(manual).length,
  note:'机械提示只辅助逐项核方；没有提示不代表完整、准确或可发布。步骤补出的原料可能只是切法／工具误识别，不自动删料。',results};
await writeFile('datasets/recipes/curation/candidate-audit-2026-10-23.json',JSON.stringify(report,null,2)+'\n');
const rows=results.filter(r=>r.fragments.length||r.manual.length).map(r=>`| ${r.id} ${r.name} | ${[...r.fragments.map(f=>`疑似残行：${f.text}`),...r.manual].join('；')} |`);
await writeFile('datasets/recipes/sources/candidate-audit-2026-10-23.md',[
  '# 候选配方质量复核','',
  `文件核查${cards.length}条固定版本社区候选，已应用${report.curated}条独立展示修订；原始卡片保留，发布0。`, '',
  `还有${report.fragmentCards}条含疑似配料残行，${report.stepInferredCards}条含从步骤补出的未定量项，另${report.manualReviewCards}条有已识别的量／步骤问题。前两类是机械提示，不等于已判错，也不能反向证明其他菜已通过。`, '',
  '| 菜品 | 待核事项 |','| --- | --- |',...rows,'',
  '## 新增原文候选的待核说明','',...supplement.map(c=>`- ${c.id} ${c.dish_key}：${c.review_notes.join('；')}`),'',
  '逐条提示见[JSON审阅清单](../curation/candidate-audit-2026-10-23.json)。已校正蒜蓉炒芹菜、黄焖鸡、乾隆白菜、排骨苦瓜汤和奶油蘑菇汤的展示；另柱候牛腩、番茄炖牛腩、牛排、广式萝卜牛腩按明确牛肉主料修正荤菜分类，仍保持待审核。原始固定提交与修订hash绑定保存于本地候选辅助表。', '',
  '待核量保留原文，不猜密度、温度、份数、营养或未记录工序。正式导入只选逐条核过的包，不把139条整体标成可推荐。','',
].join('\n'));
console.log(JSON.stringify({sourceCount:report.sourceCount,curated:report.curated,fragmentCards:report.fragmentCards,stepInferredCards:report.stepInferredCards,manualReviewCards:report.manualReviewCards,publications:0}));
