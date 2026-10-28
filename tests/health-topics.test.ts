import test from 'node:test';
import assert from 'node:assert/strict';
import { combinedTopicChoices, healthTopics, mergeTopicAssessment, removeHealthTopic, toggleTopicGroup } from '../shared/health-topics';
import { reconcileAccountValues } from '../shared/account-merge';
import { defaultMeal } from '../shared/types';
import { effectiveAiChoices } from '../shared/ai-food-choices';
import type { DietAssessment, HealthProfile } from '../shared/health-chat';
import { applyPersonalSettings } from '../shared/account';

const advice=(name:string,direction:'prefer'|'avoid'):DietAssessment=>({stage:'advice',profile:{conditions:[name],goals:[],notes:`${name}测试摘要`},suggestions:[{foodName:'鸡蛋',direction,reason:'构造测试理由',conditions:'',matchable:true,topics:[`condition:${name}`]}]});
function two(){let profile=mergeTopicAssessment(undefined,advice('风湿病','prefer'));profile=toggleTopicGroup(profile,undefined,'condition:风湿病','preferred',['鸡蛋']);profile=mergeTopicAssessment(profile,advice('糖尿病','avoid'));return toggleTopicGroup(profile,undefined,'condition:糖尿病','excluded',['鸡蛋']);}

test('疾病建议与接受记录独立，同食材冲突不覆盖来源；取消后另一来源重新生效',()=>{
  const profile=two();assert.equal(healthTopics(profile).length,2);
  assert.deepEqual(combinedTopicChoices(healthTopics(profile)),{preferred:[],limited:[],excluded:['鸡蛋']});
  const canceled=toggleTopicGroup(profile,undefined,'condition:糖尿病','excluded',['鸡蛋']);
  assert.deepEqual(combinedTopicChoices(healthTopics(canceled)),{preferred:['鸡蛋'],limited:[],excluded:[]});
  assert.equal(canceled.topics![1].suggestions[0].direction,'avoid');
});
test('删除疾病撤销它的建议、摘要和接受选择，重新添加不得恢复旧接受记录',()=>{
  const removed=removeHealthTopic(two(),'conditions','糖尿病');
  assert.equal(removed.notes,'');assert(!JSON.stringify(removed).includes('糖尿病'));
  assert.deepEqual(combinedTopicChoices(healthTopics(removed)).preferred,['鸡蛋']);
  const readded=mergeTopicAssessment(removed,advice('糖尿病','avoid'));assert.deepEqual(readded.topics![1].accepted.excluded,[]);
  const empty=removeHealthTopic(removed,'conditions','风湿病');assert.deepEqual(empty.suggestions,[]);assert.deepEqual(empty.topics,[]);
});
test('综合只取有效来源，过时全局副本和本餐偏好不能抵消已接受避开',()=>{
  const profile=two(),meal={...defaultMeal(),health:true,healthProfile:profile,aiFoodPreferences:{preferred:['花生'],limited:[],excluded:[]},aiFoodChoices:{preferred:['鸡蛋'],limited:[],excluded:[]}};
  assert.deepEqual(effectiveAiChoices(meal),{preferred:[],limited:[],excluded:['鸡蛋']});
  meal.health=false;assert.deepEqual(effectiveAiChoices(meal),{preferred:[],limited:[],excluded:[]});
});
test('跨设备同时接受与删病，删除不被另一设备的旧档案/选择复活',()=>{
  const profile=two(),defaults={...defaultMeal(),healthProfile:profile,aiFoodPreferences:combinedTopicChoices(healthTopics(profile))};
  const local={favorites:[],defaults:{...defaults,healthProfile:removeHealthTopic(profile,'conditions','糖尿病')}};
  const remote={favorites:[],defaults:{...defaults,flavor:'微辣',healthProfile:toggleTopicGroup(profile,undefined,'condition:风湿病','limited',['西红柿'])}};
  const merged=reconcileAccountValues(local,remote,{favorites:[],defaults});
  assert.deepEqual(merged.defaults?.healthProfile?.conditions,['风湿病']);assert.deepEqual(merged.defaults?.aiFoodPreferences?.excluded,[]);
  assert.deepEqual(merged.defaults?.aiFoodPreferences?.limited,['西红柿']);assert.equal(merged.defaults?.flavor,'微辣');
});
test('旧版未标记来源的记录，即使只剩一个疾病也不能把已删疾病的建议错归给它',()=>{
  const profile:HealthProfile={conditions:['风湿病','糖尿病'],goals:[],notes:'旧摘要',suggestions:advice('风湿病','prefer').suggestions.map(({topics,...item})=>item),updatedAt:new Date().toISOString()};
  assert(healthTopics(profile,{preferred:['鸡蛋'],limited:[],excluded:[]}).every(topic=>!topic.suggestions.length&&!topic.accepted.preferred.length));
  profile.conditions=['风湿病'];assert.deepEqual(healthTopics(profile,{preferred:['鸡蛋'],limited:[],excluded:[]})[0].accepted.preferred,[]);assert.deepEqual(healthTopics(profile)[0].suggestions,[]);
});
test('另一设备删除疾病时，本机旧临时食材选择也失效，但保留本餐库存',()=>{
  const profile=two(),meal={...defaultMeal(),healthProfile:profile,diseases:['风湿病','糖尿病'],raw:'鸡蛋3个',aiFoodChoices:{preferred:[],limited:[],excluded:['鸡蛋']}};
  const next=applyPersonalSettings(meal,{...defaultMeal(),healthProfile:removeHealthTopic(profile,'conditions','糖尿病')});
  assert.equal(next.aiFoodChoices,undefined);assert.deepEqual(next.diseases,['风湿病']);assert.equal(next.raw,'鸡蛋3个');
});
