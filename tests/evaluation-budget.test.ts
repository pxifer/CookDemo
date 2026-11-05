import test from 'node:test';
import assert from 'node:assert/strict';
import { EvaluationBudget,type VerifiedPricing } from '../scripts/lib/evaluation-budget';
import { openEvaluationBudget } from '../scripts/lib/evaluation-budget-ledger';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const pricing:VerifiedPricing={model:'deepseek-flash',currency:'CNY',inputPerMillion:100,outputPerMillion:200,verifiedDate:'2026-10-29',source:'https://api-docs.deepseek.com/test-fixture'};
test('评测费用最多预留5元，未知消耗不退款，过期或未核价目不能调用',()=>{
  const b=new EvaluationBudget(5,pricing,'2026-10-29');const amount=b.reserve(1000,2400);assert(amount>0);
  b.restoreReserved(5_000_000-amount);b.reserve(1000,2400);assert.equal(b.reservedMicroCny,5_000_000);assert.throws(()=>b.reserve(1,1),/EXHAUSTED/);
  assert.throws(()=>new EvaluationBudget(6,pricing,'2026-10-29'));assert.throws(()=>new EvaluationBudget(5,pricing,'2026-10-30'));assert.throws(()=>new EvaluationBudget(5,{...pricing,source:'https://unverified.invalid'},'2026-10-29'));
});
test('预算账本跨运行保留预留、并发进程锁拒绝重复认领、损坏账本不能重置额度',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shiwei-evaluation-budget-')),path=join(dir,'ledger.jsonl'),price=join(dir,'price.json');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  try{
    await writeFile(price,JSON.stringify({...pricing,verifiedDate:today}));
    const first=await openEvaluationBudget(price,path);let amount:number;
    try{amount=await first.reserve('synthetic test body',2400);await assert.rejects(openEvaluationBudget(price,path),{code:'EEXIST'});}finally{await first.close();}
    const second=await openEvaluationBudget(price,path);try{assert.equal(second.reservedMicroCny(),amount!);await second.reserve('another test body',2400);assert(second.reservedMicroCny()>amount!);}finally{await second.close();}
    await writeFile(path,'{"reservedMicroCny":1}');await assert.rejects(openEvaluationBudget(price,path),/LEDGER_TRUNCATED/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
