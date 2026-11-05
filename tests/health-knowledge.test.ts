import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../backend/src/db';
import { validateKnowledgeBundle, factAvailability, searchKnowledge, sha256 } from '../backend/src/health-knowledge';
import { HealthKnowledgeRepository } from '../backend/src/health-knowledge-repository';
import { verifyHealthRelease } from '../backend/src/health';
const bundle = validateKnowledgeBundle(JSON.parse(await readFile(new URL('../datasets/health/2026-10-28-v1/knowledge-bundle.json', import.meta.url),'utf8')));
const manifest = JSON.parse(await readFile(new URL('../datasets/health/2026-10-28-v1/manifest.json', import.meta.url),'utf8'));
const context = {adult:'yes',renalFunction:'normal',complexComorbidity:'no',diabetesType:'type2',hypoglycemiaRescue:'no'};

test('真实知识包校验：manifest、引用、形态、分类区间和测定值，缺量保持null', async()=>{
  for (const [file,hash] of Object.entries(manifest.files)) assert.equal(sha256(await readFile(new URL('../datasets/health/2026-10-28-v1/'+file,import.meta.url))),hash);
  assert.equal(bundle.sources.length,7);
  assert.equal(bundle.facts.find(f=>f.id==='fact:kaneko-purine-tofu-momen-boiled')?.quantity?.value,21.9);
  assert.equal(bundle.facts.find(f=>f.id==='fact:nhc-purine-shiitake-fresh')?.quantity?.value,null);
  assert.equal(bundle.facts.find(f=>f.id==='fact:kaneko-purine-shiitake-fresh')?.quantity?.value,20.8);
  assert.ok(bundle.facts.some(f=>f.quantity===null));
  assert.ok(bundle.conflicts.find(c=>c.id==='conflict:shiitake')?.factIds?.length===2);
  assert.ok(!bundle.facts.some(f=>/banana|strawberry/.test(f.id)));
});

test('无效来源版本、孤立引用、错接实体、伪造审批和缺失定位均拒绝',()=>{
  const mutations = [
    (b:typeof bundle)=>{b.evidence[0].sourceVersion='made-up';},
    (b:typeof bundle)=>{b.facts[0].evidenceIds=['missing'];},
    (b:typeof bundle)=>{b.facts[0].objectId='f:milk';},
    (b:typeof bundle)=>{(b.ruleDrafts[0] as {status:string}).status='approved';},
    (b:typeof bundle)=>{b.evidence[0].originalSpan+='changed';},
    (b:typeof bundle)=>{b.evidence[0].locator.end=null;},
  ];
  for (const change of mutations) {const copy=structuredClone(bundle);change(copy);assert.throws(()=>validateKnowledgeBundle(copy),/HEALTH_KNOWLEDGE_INVALID/);}
});

test('条件三态逐条传播：缺肾功能只影响相关条目，药物/分型未知不伪造',()=>{
  const potassium=bundle.facts.find(f=>f.id==='fact:ht-potassium')!;
  const salt=bundle.facts.find(f=>f.id==='fact:ht-limit-salt')!;
  assert.equal(factAvailability(bundle,potassium,{adult:'yes'}),'needs_confirmation');
  assert.equal(factAvailability(bundle,salt,{adult:'yes'}),'applicable_for_research');
  assert.equal(factAvailability(bundle,potassium,{adult:'yes',renalFunction:'impaired'}),'not_applicable');
  assert.equal(factAvailability(bundle,potassium,{adult:'yes',renalFunction:'normal',hyperkalemia:'no'}),'applicable_for_research');
  assert.equal(searchKnowledge(bundle,'糖尿病能喝酒吗').state,'needs_confirmation');
  assert.equal(searchKnowledge(bundle,'不存在的食物zqxv').state,'insufficient_evidence');
});

test('撤回作用于支持及限制证据和版本，不靠关键词分数复活',()=>{
  const f=bundle.facts.find(f=>f.id==='fact:gout-limit-juice')!;
  const qualifier=f.qualifyingEvidenceIds[0];
  assert.equal(factAvailability(bundle,f,context,new Set([qualifier])),'withdrawn');
  for (const target of ['nhc-gout-2024','nhc-gout-2024@2024',bundle.sources.find(s=>s.id==='nhc-gout-2024')!.sourceHash,bundle.id])
    assert.equal(factAvailability(bundle,f,context,new Set([target])),'withdrawn');
  const result=searchKnowledge(bundle,'痛风 鲜榨果汁',{context,revoked:new Set(['nhc-gout-2024'])});
  assert.ok(!result.hits.some(h=>h.fact.subjectId==='d:gout'));
});

test('少吃、避免和可适量分开；成分组成不能直接产生新疾病动作',()=>{
  const usual=bundle.facts.find(f=>f.id==='fact:gout-alcohol')!;
  const acute=bundle.facts.find(f=>f.id==='fact:gout-alcohol-avoid')!;
  assert.equal(usual.predicate,'limit');assert.equal(acute.predicate,'avoid');
  assert.equal(factAvailability(bundle,acute,context),'needs_confirmation');
  assert.equal(factAvailability(bundle,acute,{...context,goutAlcoholAvoidanceContext:'acute_attack'}),'applicable_for_research');
  assert.equal(factAvailability(bundle,acute,{...context,goutAlcoholAvoidanceContext:'intercritical'}),'not_applicable');
  assert.equal(bundle.facts.find(f=>f.id==='fact:gout-tofu')?.predicate,'insufficient_evidence');
  assert.ok(!bundle.facts.some(f=>f.kind==='food_guidance'&&f.objectId==='f:shiitake-fresh'));
  assert.ok(bundle.facts.filter(f=>f.kind==='cooking_effect').every(f=>f.scope==='process_evidence_only_not_disease_rule'));
  assert.equal(searchKnowledge(bundle,'痛风 牛奶',{context}).executionAllowed,false);
  assert.equal(verifyHealthRelease(undefined,['痛风'],[],new Set(),{}).state,'unavailable');
});

test('本地PG研究结构：原子导入、幂等、版本不覆盖、撤回后重导不能复活',async()=>{
  const engine=new PGlite();
  const db:Database={query:(s,p)=>engine.query(s,p),exec:async s=>{await engine.exec(s);},close:()=>engine.close()};
  const repo=new HealthKnowledgeRepository(db);
  try {
    await repo.initializeResearchSchema();
    assert.equal((await repo.importResearch(bundle,manifest)).imported,true);
    assert.equal((await repo.importResearch(bundle,manifest)).imported,false);
    const loaded=await repo.load(bundle.id);assert.equal(loaded.facts.length,bundle.facts.length);
    assert.equal((await db.query<{n:number}>('SELECT count(*)::int n FROM health_kb.health_fact_evidence')).rows[0].n,bundle.facts.reduce((n,f)=>n+f.evidenceIds.length+f.qualifyingEvidenceIds.length,0));
    assert.ok((await repo.search(bundle.id,'痛风 牛奶',{context})).hits.some(h=>h.fact.id==='fact:gout-prefer-milk'));
    await repo.withdraw('nhc-gout-2024','构造撤回测试');
    await repo.importResearch(bundle,manifest);
    assert.ok(!(await repo.search(bundle.id,'痛风 牛奶',{context})).hits.some(h=>h.fact.subjectId==='d:gout'));
    const changed=structuredClone(bundle);changed.facts[0].statement+=' changed';
    await assert.rejects(repo.importResearch(changed,manifest),/HEALTH_BUNDLE_IMMUTABLE/);
    const bad={...db,query:async <T>(sql:string,params?:unknown[])=>{if(sql.startsWith('INSERT INTO health_kb.health_facts'))throw new Error('interrupted');return db.query<T>(sql,params);}};
    const next=structuredClone(bundle);next.id+='-interrupted';
    await assert.rejects(new HealthKnowledgeRepository(bad).importResearch(next,manifest),/interrupted/);
    assert.equal((await db.query('SELECT id FROM health_kb.health_releases WHERE id=$1',[next.id])).rows.length,0);
    // Unknown foreign keys fail even for direct database writes.
    await assert.rejects(db.query('INSERT INTO health_kb.health_fact_evidence VALUES($1,$2,$3,$4)',[bundle.id,'missing','missing','support']));
  } finally {await db.close();}
});
