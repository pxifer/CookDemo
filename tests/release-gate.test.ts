import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReleaseGate,type ReleaseEvidence } from '../scripts/lib/release-gate';
test('发布门禁拒绝未执行、权限阻塞、不同源码和重复证据，本地通过不能覆盖真实验收',()=>{
  const good:ReleaseEvidence={id:'local',status:'passed',sourceFingerprint:'revision-a',report:'local/report.json',reportSha256:'a'.repeat(64),kind:'local'};
  assert.equal(evaluateReleaseGate(['local','pg'],[good],'revision-a').ready,false);
  for(const status of ['failed','permission_blocked','not_run'] as const)assert.equal(evaluateReleaseGate(['local'],[{...good,status}],'revision-a').ready,false);
  assert.equal(evaluateReleaseGate(['local'],[good],'revision-b').ready,false);
  assert.equal(evaluateReleaseGate(['local'],[good,good],'revision-a').ready,false);
  assert.equal(evaluateReleaseGate(['local'],[{...good,reportSha256:undefined}],'revision-a').ready,false);
  assert.equal(evaluateReleaseGate(['local'],[good],'revision-a').ready,true);
});
