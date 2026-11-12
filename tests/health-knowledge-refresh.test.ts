import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../backend/src/db';
import { validateKnowledgeBundle, factAvailability, searchKnowledge } from '../backend/src/health-knowledge';
import { knownEvidenceWithdrawalIds } from '../backend/src/health-knowledge-policy';
import { evidenceActive } from '../backend/src/rag/retrieval';
import { HealthKnowledgeRepository } from '../backend/src/health-knowledge-repository';
import { readKnowledgeAssets } from '../backend/src/health-knowledge-assets';
import {spawnSync} from 'node:child_process';

const legacy=validateKnowledgeBundle(JSON.parse(await readFile(new URL('../datasets/health/2026-10-28-v2/knowledge-bundle.json',import.meta.url),'utf8')));
const oldReduce=legacy.evidence.find(e=>e.key==='nci-reduce')!;
const microwave=legacy.facts.find(f=>f.id==='fact:microwave-hca')!;
const conditions={inputFoodClass:'muscle_meat',subsequentHighHeatShortened:'yes'};

test('正文重整仅取完整唯一正文块，拒绝导航/标题、歧义及原件变更',()=>{
  const result=spawnSync(process.env.DOCUMENT_PARSER_PYTHON??'python',['-B','-X','utf8','tests/health_knowledge_refresh_test.py'],{encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/Ran 5 tests/);assert.doesNotMatch(result.stderr,/skipped=/);
});

test('已知导航/不完整短摘隔离跨旧包生效，A0/A1与必需证据都不能复活',()=>{
  assert.equal(knownEvidenceWithdrawalIds.length,3);
  assert.equal(oldReduce.originalSpan,'reduceHCAandPAHformation');
  assert.equal(factAvailability(legacy,microwave,conditions),'withdrawn');
  assert.equal(evidenceActive(legacy,oldReduce.id,new Set()),false);
  for(const algorithm of ['a0','a1'] as const){
    const result=searchKnowledge(legacy,'微波预熟杂环胺',{context:conditions,algorithm});
    assert(!result.hits.some(h=>h.fact.id===microwave.id));
  }
  const required=searchKnowledge(legacy,'微波预熟杂环胺',{context:conditions,requiredEvidenceIds:[oldReduce.id]});
  assert.equal(required.state,'evidence_missing');
  assert(required.evidencePack.missingRequired.includes(oldReduce.id));
  // Unrelated food guidance is not swept away by an entire-source or whole-bundle ban.
  assert(searchKnowledge(legacy,'高血压食盐',{context:{adult:'yes'}}).hits.some(h=>h.fact.id==='fact:ht-limit-salt'));
});

test('新默认版本替换短摘，保留95条原证据与所有疾病指导；工艺事实支持/限定完整',async()=>{
  const {bundle,manifest}=await readKnowledgeAssets();
  assert.equal(bundle.id,'health-kb-2026-11-12-v3');assert.equal(manifest.counts.evidence,99);
  assert.equal(bundle.facts.length,260);assert.equal(bundle.evidence.length,99);
  assert(knownEvidenceWithdrawalIds.every(id=>!bundle.evidence.some(e=>e.id===id)&&bundle.revocations.includes(id)));
  for(const e of legacy.evidence.filter(e=>e.sourceId!=='nci-cooked-meats-2017'))assert.deepEqual(bundle.evidence.find(row=>row.id===e.id),e);
  assert.deepEqual(bundle.facts.filter(f=>f.kind==='food_guidance'),legacy.facts.filter(f=>f.kind==='food_guidance'));
  const updated=bundle.facts.find(f=>f.id===microwave.id)!;
  assert.equal(factAvailability(bundle,updated,conditions),'needs_confirmation');
  assert.equal(factAvailability(bundle,updated,{...conditions,microwavePreheating:'no'}),'not_applicable');
  assert.equal(factAvailability(bundle,updated,{...conditions,microwavePreheating:'yes'}),'applicable_for_research');
  const support=bundle.evidence.find(e=>e.id===updated.evidenceIds[0])!;
  assert(support.originalSpan.startsWith('Using a microwave oven to cook meat prior'));
  assert(support.originalSpan.includes('reducing the time'));assert.equal(updated.qualifyingEvidenceIds.length,2);
  const result=searchKnowledge(bundle,'微波预熟杂环胺',{context:{...conditions,microwavePreheating:'yes'},requiredEvidenceIds:updated.evidenceIds,limit:1});
  assert.equal(result.state,'research_results');
  assert(updated.qualifyingEvidenceIds.every(id=>result.evidencePack.qualifying.some(e=>e.evidenceId===id)));
  const noExemption=searchKnowledge(bundle,'微波预熟杂环胺',{context:{...conditions,microwavePreheating:'yes'},requiredEvidenceIds:updated.evidenceIds,revoked:new Set([updated.qualifyingEvidenceIds[0]])});
  assert.equal(noExemption.state,'evidence_missing');
  await assert.rejects(readKnowledgeAssets('../2026-10-28-v2'),/VERSION_UNKNOWN/);
  for(const change of [(b:typeof bundle)=>{b.evidence[95].verification='source_checked';},(b:typeof bundle)=>{b.evidence[95].locator.kind='html_visual';},(b:typeof bundle)=>{b.evidence[95].locator.normalization='remove_unicode_whitespace_v1';}]){
    const changed=structuredClone(bundle);change(changed);assert.throws(()=>validateKnowledgeBundle(changed),/HEALTH_KNOWLEDGE_INVALID/);
  }
});

test('重新导入旧包也记录隔离，数据库加载/查询和新实例不能复活旧支持',async()=>{
  const engine=new PGlite();
  let simulatePrePolicyImport=true;
  const db:Database={query:(s,p)=>simulatePrePolicyImport&&s.startsWith('INSERT INTO health_kb.health_revocations')?Promise.resolve({rows:[]}):engine.query(s,p),exec:async s=>{await engine.exec(s);},close:()=>engine.close()};
  try{
    const repository=new HealthKnowledgeRepository(db);await repository.initializeResearchSchema();
    await repository.importResearch(legacy,{});
    // Simulate the old importer, without deleting append-only withdrawals or disabling triggers.
    simulatePrePolicyImport=false;
    assert.equal((await repository.importResearch(legacy,{})).imported,false);
    const stored=await repository.load(legacy.id);assert.equal(stored.evidence.find(e=>e.id===oldReduce.id)!.originalSpan,oldReduce.originalSpan);
    const rows=await db.query<{target_id:string}>('SELECT target_id FROM health_kb.health_revocations');
    assert(knownEvidenceWithdrawalIds.every(id=>rows.rows.some(r=>r.target_id===id)));
    const result=await new HealthKnowledgeRepository(db).search(legacy.id,'微波预熟杂环胺',{context:conditions});
    assert(!result.hits.some(h=>h.fact.id===microwave.id));
  }finally{await engine.close();}
});
