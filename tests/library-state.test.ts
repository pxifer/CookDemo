import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryUrl,readLibraryState } from '../src/library-state';
test('图鉴链接往返保留搜索筛选、页码、菜名和真实口味，内部来源地址不进入链接',()=>{
  const value=readLibraryState('?q=鸡&ingredient=鸡肉&method=蒸&flavor=咸鲜&category=荤菜&page=2&dish=冬瓜桑拿鸡&taste=咸鲜');
  assert.equal(value.page,1);assert.equal(value.selected,'冬瓜桑拿鸡');assert.deepEqual(readLibraryState(libraryUrl(value).split('?')[1]),value);
  const back={...value,selected:null,variant:''};assert.equal(readLibraryState(libraryUrl(back).split('?')[1]).query,'鸡');assert(!libraryUrl(back).includes('taste='));
  assert(!libraryUrl(value).includes('github'));
});
test('有限链接边界：负数、小数、超长和非数字页码受限，输入长度与控制符受限',()=>{
  for(const p of ['-1','1.5','NaN','Infinity','9999999'])assert.equal(readLibraryState('?page='+p).page,0);
  assert.equal(readLibraryState('?page=0').page,0);assert.equal(readLibraryState('?page=9999').page,999);
  const v=readLibraryState('?q='+encodeURIComponent('\u0000'+'字'.repeat(500))+'&dish='+encodeURIComponent('菜'.repeat(200)));
  assert.equal(v.query.length,80);assert(!v.query.includes('\u0000'));assert.equal(v.selected?.length,150);
});
