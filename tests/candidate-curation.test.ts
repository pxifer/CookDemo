import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { candidateHash,curateCandidate,type CandidateCard } from '../scripts/lib/candidate-curation';
const cards=(await readFile('docs/data/recipe-cards-v3.jsonl','utf8')).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s) as CandidateCard);
test('候选纠错保留原文指纹，切法不变食材，数量区间不拆行，味型与配料一致',()=>{
  const before=JSON.stringify(cards);
  const celery=curateCandidate(cards.find(c=>c.id==='R288')!)!;
  assert.deepEqual(celery.record.aux,['蒜 4 瓣（切末）']);assert.equal(celery.record.main!.length,1);
  const chicken=curateCandidate(cards.find(c=>c.id==='R337')!)!;
  assert(!chicken.record.aux!.some(s=>s.startsWith('马蹄')));assert(chicken.record.seasonings!.includes('干辣椒 5～6 个'));
  const cabbage=curateCandidate(cards.find(c=>c.id==='R391')!)!;
  assert.equal(cabbage.record.flavor,'麻酱酸甜');assert.equal(cabbage.sourceSha256,candidateHash(cards.find(c=>c.id==='R391')));
  assert.equal(cabbage.state,'pending_review');assert.equal(JSON.stringify(cards),before);
  const soup=curateCandidate(cards.find(c=>c.id==='R315')!)!;
  assert.equal(soup.record.steps!.length,3);assert.equal(soup.record.method_options!.length,2);
  assert(soup.record.method_options![0].steps.join(' ').includes('120～240分钟'));
  assert(soup.record.method_options![1].steps.join(' ').includes('45分钟'));
  assert.equal(curateCandidate(cards.find(c=>c.id==='R345')!)!.record.steps!.length,7);
  for(const id of ['R261','R272','R321','R389']){
    const original=cards.find(c=>c.id===id)!,corrected=curateCandidate(original)!;
    assert.equal(corrected.record.category,'meat');assert.equal(original.category,'veg');
    assert.equal(corrected.sourceSha256,candidateHash(original));
  }
  assert.equal(curateCandidate(cards.find(c=>c.id==='R270')!),null);
});
test('纠错原记录发生变化则停止，不能将旧补丁套到新原方',()=>{
  const card=structuredClone(cards.find(c=>c.id==='R337')!);card.seasonings=card.seasonings!.filter(s=>s!=='6 个');
  assert.throws(()=>curateCandidate(card),/CANDIDATE_CURATION_BASE_MISMATCH/);
});
