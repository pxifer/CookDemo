import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../backend/src/db';
import { searchKnowledge, searchKnowledgeA0, resolveKnowledgeQuery, validateKnowledgeBundle, canonicalKnowledgeHash } from '../backend/src/health-knowledge';
import { HealthKnowledgeRepository } from '../backend/src/health-knowledge-repository';
const bundle=validateKnowledgeBundle(JSON.parse(await readFile(new URL('../datasets/health/2026-10-28-v2/knowledge-bundle.json', import.meta.url),'utf8')));
const manifest=JSON.parse(await readFile(new URL('../datasets/health/2026-10-28-v2/manifest.json', import.meta.url),'utf8'));
const ctx={adult:'yes',renalFunction:'normal',complexComorbidity:'no',diabetesType:'type2',hyperkalemia:'no',pregnantOrLactating:'no',osteoporosisType:'primary',ckdStage:'G4',dialysis:'no',clinicianNutritionPlan:'yes',edema:'no',lipidPattern:'high_triglycerides'};

test('v2保留v1逐条记录，四个新增主题和官方图像定位均完整',async()=>{
  const v1=JSON.parse(await readFile(new URL('../datasets/health/2026-10-28-v1/knowledge-bundle.json', import.meta.url),'utf8'));
  for(const key of ['sources','entities','evidence','facts','ruleDrafts','conflicts'] as const) {
    const rows=new Map(bundle[key].map(r=>[r.id,r]));
    for(const row of v1[key])assert.deepEqual(rows.get(row.id),row);
  }
  for(const id of ['d:dyslipidemia','d:obesity','d:ckd','d:primary-osteoporosis'])assert.ok(bundle.entities.some(e=>e.id===id));
  const visuals=bundle.evidence.filter(e=>e.locator.kind==='html_visual');
  assert.equal(visuals.length,10);assert.ok(visuals.every(e=>e.locator.pdfPage===null&&e.locator.assetUrl&&e.locator.verifiedPageImageHash));
});

test('最长匹配抑制饱和/不饱和子串碰撞，保留否定而不改动作',()=>{
  const resolved=resolveKnowledgeQuery(bundle,'高血脂患者不要把不饱和脂肪酸当成饱和脂肪酸');
  assert.ok(resolved.matched.some(e=>e.id==='c:unsaturated-fat'));
  const single=resolveKnowledgeQuery(bundle,'高血脂可以选择不饱和脂肪酸吗');
  assert.ok(!single.matched.some(e=>e.id==='c:saturated-fat'));
  const result=searchKnowledge(bundle,'高血脂可以选择不饱和脂肪酸吗',{context:ctx});
  assert.ok(result.hits.some(h=>h.fact.id==='fact:lipid-unsaturated'));
  assert.ok(!result.hits.some(h=>h.fact.id==='fact:lipid-saturated-fat'));
  const negative=resolveKnowledgeQuery(bundle,'我不吃豆腐');assert.equal(negative.mentions.find(m=>m.ids.includes('f:tofu'))?.negated,true);
  assert.equal(bundle.facts.find(f=>f.id==='fact:gout-tofu')?.predicate,'insufficient_evidence');
});

test('食品形态与疾病分型歧义显式返回；已确认2型参数不再重复询问',()=>{
  for(const query of ['香菇能吃吗','骨质疏松症怎么吃','肾病能吃什么','糖尿病能吃豆腐吗'])assert.equal(searchKnowledge(bundle,query).state,'needs_confirmation');
  assert.equal(searchKnowledge(bundle,'糖尿病能吃豆腐吗',{diseaseId:'d:type2-diabetes',context:ctx}).state,'research_results');
  assert.equal(searchKnowledge(bundle,'骨质疏松症牛奶',{diseaseId:'d:primary-osteoporosis',context:ctx}).state,'research_results');
  const fresh=searchKnowledge(bundle,'鲜香菇总嘌呤',{context:ctx,limit:20});
  assert.ok(fresh.hits.some(h=>h.fact.id==='fact:kaneko-purine-shiitake-fresh'));
  assert.ok(!fresh.hits.some(h=>h.fact.id==='fact:kaneko-purine-shiitake-dry'));
  assert.equal(searchKnowledge(bundle,'火星果xyz').state,'insufficient_evidence');
  assert.throws(()=>searchKnowledge(bundle,'豆腐',{limit:NaN}),/LIMIT_INVALID/);
});

test('必需证据与例外独立于top-k，撤回或不存在时不伪装完整',()=>{
  const f=bundle.facts.find(f=>f.id==='fact:gout-limit-juice')!;
  const result=searchKnowledge(bundle,'高血压食盐',{context:ctx,limit:1,requiredEvidenceIds:f.evidenceIds});
  assert.equal(result.hits.length,1);
  assert.ok('evidencePack'in result&&result.evidencePack.required.some(e=>e.evidenceId===f.evidenceIds[0]));
  assert.ok('evidencePack'in result&&result.evidencePack.qualifying.some(e=>e.evidenceId===f.qualifyingEvidenceIds[0]));
  const blocked=searchKnowledge(bundle,'高血压食盐',{requiredEvidenceIds:f.evidenceIds,revoked:new Set([f.qualifyingEvidenceIds[0]])});
  assert.equal(blocked.state,'evidence_missing');
  assert.equal(searchKnowledge(bundle,'食盐',{requiredEvidenceIds:['missing']}).state,'evidence_missing');
});

test('CKD蛋白、钾与骨质疏松范围按条件处理，组合无自动批准',()=>{
  const late=searchKnowledge(bundle,'慢性肾病低蛋白大米',{context:ctx});
  assert.ok(late.hits.some(h=>h.fact.id==='fact:ck-late-low-protein-rice'));
  const dialysis=searchKnowledge(bundle,'慢性肾病低蛋白大米',{context:{...ctx,dialysis:'yes'}});
  assert.ok(!dialysis.hits.some(h=>h.fact.id==='fact:ck-late-low-protein-rice'));
  const lowNa=searchKnowledge(bundle,'慢性肾病低钠盐',{context:ctx});
  assert.ok(!lowNa.hits.some(h=>h.fact.id==='fact:ck-high-k-low-sodium-potassium-salt'));
  const highK=searchKnowledge(bundle,'慢性肾病低钠盐',{context:{...ctx,hyperkalemia:'yes'}});
  assert.ok(highK.hits.some(h=>h.fact.id==='fact:ck-high-k-low-sodium-potassium-salt'));
  const secondary=searchKnowledge(bundle,'原发性骨质疏松症牛奶',{context:{...ctx,osteoporosisType:'secondary'}});
  assert.ok(!secondary.hits.some(h=>h.fact.subjectId==='d:primary-osteoporosis'));
  const combined=searchKnowledge(bundle,'慢性肾病和原发性骨质疏松症蛋白质',{context:ctx});
  assert.equal(combined.executionAllowed,false);
  assert.ok('combinationSupport'in combined&&combined.combinationSupport==='not_evaluated');
  assert.ok(combined.hits.some(h=>h.conflicts.some(c=>c.id==='conflict:ckd-osteoporosis-protein')));
});

test('持久化完整性和缓存：保留元数据、禁止原地篡改、缓存命中仍采用最新撤回',async()=>{
  const engine=new PGlite();let factReads=0,revReads=0,withdrawDuringFinalRead=false;
  const db:Database={query:async <T>(sql:string,p?:unknown[])=>{
    if(sql.includes('SELECT fact FROM'))factReads++;
    if(sql==='SELECT target_id FROM health_kb.health_revocations'){
      revReads++;
      if(withdrawDuringFinalRead&&revReads%2===0){
        withdrawDuringFinalRead=false;
        await engine.query('INSERT INTO health_kb.health_revocations(target_id,reason) VALUES($1,$2)',['nhc-ckd-2024','constructed mid-query revocation']);
      }
    }
    return engine.query<T>(sql,p);
  },exec:async s=>{await engine.exec(s);},close:()=>engine.close()};
  const repo=new HealthKnowledgeRepository(db);
  try{
    await repo.initializeResearchSchema();await repo.importResearch(bundle,manifest);
    const loaded=await repo.load(bundle.id);assert.deepEqual(loaded.boundaries,bundle.boundaries);
    assert.equal(canonicalKnowledgeHash(loaded),canonicalKnowledgeHash(bundle));
    const reads=factReads;await repo.load(bundle.id);assert.equal(factReads,reads);
    assert.throws(()=>{loaded.facts[0].statement='tamper';},TypeError);
    await assert.rejects(db.query('UPDATE health_kb.health_facts SET predicate=$1 WHERE bundle_id=$2',['avoid',bundle.id]),/IMMUTABLE/);
    await repo.search(bundle.id,'高血脂全谷物',{context:ctx});
    await repo.withdraw('cdc-dyslipidemia-2023','constructed revocation');
    const withdrawn=await repo.search(bundle.id,'高血脂全谷物',{context:ctx});
    assert.ok(!withdrawn.hits.some(h=>h.fact.subjectId==='d:dyslipidemia'));assert.ok(revReads>=4);
    withdrawDuringFinalRead=true;
    const changedDuringQuery=await repo.search(bundle.id,'慢性肾病食盐',{context:ctx});
    assert.ok(!changedDuringQuery.hits.some(h=>h.fact.subjectId==='d:ckd'));
    assert.notEqual(changedDuringQuery.revocationWatermark,withdrawn.revocationWatermark);
    await assert.rejects(db.query('DELETE FROM health_kb.health_revocations'),/IMMUTABLE/);
    const copy=structuredClone(bundle);copy.id+='-copy';copy.createdDate='2026-10-29';
    await repo.importResearch(copy,manifest);
    assert.equal((await repo.load(copy.id)).createdDate,'2026-10-29');
    assert.ok(!(await repo.search(copy.id,'高血脂全谷物',{context:ctx})).hits.some(h=>h.fact.subjectId==='d:dyslipidemia'));
  }finally{await db.close();}
});

test('A0可显式复现旧基线，A1提供分通道排名且不成为审批',()=>{
  assert.equal(searchKnowledgeA0(bundle,'高血压 食盐').index,'lexical-v1');
  const result=searchKnowledge(bundle,'医生说我有高血压，请问食盐应当怎么选择',{context:ctx});
  assert.equal(result.index,'lexical-v2');assert.equal(result.executionAllowed,false);
  assert.ok(result.hits.some(h=>h.fact.id==='fact:ht-limit-salt'));
  assert.ok(result.hits.every(h=>'channels'in h&&h.citations.length>0));
});
