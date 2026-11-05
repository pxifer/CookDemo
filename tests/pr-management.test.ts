import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewVerdict } from '../scripts/lib/pr-management';

const checked = { phase: 'pre-merge' as const, expectedHead: 'reviewed', actualHead: 'reviewed', branch: 'agent/test/task',
  cleanBefore: true, cleanAfter: true, sourceStable: true, baseIsAncestor: true, stages: [{ status: 'passed' as const }] };

test('提交更新、工作区变动、检查中源码改变及过期基线不能沿用通过结论', () => {
  assert.equal(reviewVerdict(checked), 'passed');
  for (const change of [{ actualHead: 'new-commit' }, { cleanBefore: false }, { cleanAfter: false }, { sourceStable: false }, { baseIsAncestor: false }, { stages: [] }]) {
    assert.equal(reviewVerdict({ ...checked, ...change }), 'incomplete');
  }
});
test('预检通过仍未完成正式审核；主分支复验必须在 main 执行', () => {
  assert.equal(reviewVerdict({ ...checked, phase: 'preflight' }), 'incomplete');
  assert.equal(reviewVerdict({ ...checked, phase: 'post-merge' }), 'incomplete');
  assert.equal(reviewVerdict({ ...checked, phase: 'post-merge', branch: 'main' }), 'passed');
});
test('失败证据优先于未完成，不能用其他通过项抵消', () => {
  assert.equal(reviewVerdict({ ...checked, cleanAfter: false, stages: [{ status: 'passed' }, { status: 'failed' }] }), 'failed');
});
