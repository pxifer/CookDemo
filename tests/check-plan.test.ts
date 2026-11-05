import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPlan,type CheckSummary} from '../scripts/lib/check-plan';
const ids=['validation','types','acceptance-types','web-build','unit','browser','health-browser','business-browser','pg-candidates','pg-community'];
const report=():CheckSummary=>({sourceStable:true,results:ids.map(id=>({id,status:['browser','business-browser','pg-candidates'].includes(id)?'failed':'passed'}))});
test('失败组补测只选择失败项和四项预检，不复制之前通过阶段',()=>{
  assert.deepEqual(checkPlan(ids).selected,ids);
  const previous=report(),original=structuredClone(previous),plan=checkPlan(ids,previous);
  assert.equal(plan.mode,'retry_failed');assert.deepEqual(plan.selected,['validation','types','acceptance-types','web-build','browser','business-browser','pg-candidates']);
  assert.deepEqual(previous,original);assert(!plan.selected.includes('health-browser'));assert(!plan.selected.includes('pg-community'));
});
test('补测拒绝未知命令、重复/缺失阶段、运行中变更源码和无失败报告',()=>{
  const changed=report();changed.sourceStable=false;assert.throws(()=>checkPlan(ids,changed),/STABLE/);
  const unknown=report();unknown.results[0].id='arbitrary-command';assert.throws(()=>checkPlan(ids,unknown),/INVALID/);
  const duplicate=report();duplicate.results[0].id=duplicate.results[1].id;assert.throws(()=>checkPlan(ids,duplicate),/INVALID/);
  const missing=report();missing.results.pop();assert.throws(()=>checkPlan(ids,missing),/ALL_STAGE/);
  const good=report();good.results.forEach(row=>row.status='passed');assert.throws(()=>checkPlan(ids,good),/NO_FAILED/);
});
