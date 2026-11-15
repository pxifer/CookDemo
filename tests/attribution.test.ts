import test from 'node:test';
import assert from 'node:assert/strict';
import { publicAttributionLabel } from '../shared/attribution';

test('公开署名只保留最前面的来源名', () => {
  const cases: [string, string][] = [
    ['小鹿yoyo｜标题王刚版', '小鹿yoyo'],
    ['好豆菜谱（MIRecipe公开存档）', '好豆菜谱'],
    ['夏叔厨房／B站原视频简介', '夏叔厨房'],
    ['央视《天天饮食》/屈浩', '央视《天天饮食》'],
    ['央视网《回家吃饭》｜演示嘉宾石小满', '央视网《回家吃饭》'],
    ['庄祖宜（原站署名）', '庄祖宜'],
    ['丽丽4797｜注明参考小红书周壹并改量', '丽丽4797'],
    ['待我去买个橘子｜注明转自B站隋坡', '待我去买个橘子'],
    ['Hannie厨房小白｜注明复刻农国栋', 'Hannie厨房小白'],
    ['爷俩儿好菜｜抖音索引文稿', '爷俩儿好菜'],
  ];
  for (const [author, expected] of cases) assert.equal(publicAttributionLabel(author), expected, author);
});

test('本身就是单一来源名时原样保留', () => {
  for (const author of ['美食作家王刚', '央视网《天天饮食》', 'HowToCook 社区菜谱', '厨娘初长', '小鹿yoyo']) {
    assert.equal(publicAttributionLabel(author), author, author);
  }
});

test('注释在前时不产生空署名', () => {
  assert.equal(publicAttributionLabel('｜注明搬运老饭骨'), '注明搬运老饭骨');
  assert.equal(publicAttributionLabel('好豆菜谱（MIRecipe公开存档） '), '好豆菜谱');
  assert.equal(publicAttributionLabel('   '), '');
});
