import test from 'node:test';
import assert from 'node:assert/strict';
import {readFoodGuidanceAssets} from '../backend/src/rag/food-guidance-repository';
import {createFoodGuidanceProvider} from '../backend/src/rag/food-guidance';
import {researchFoodChat} from '../backend/src/rag/food-guidance-chat';
import {constructedContent} from '../shared/catalog';
import {contentContext} from '../shared/content';

const assets = await readFoodGuidanceAssets();
const content = contentContext(constructedContent);
const provider = () => createFoodGuidanceProvider(assets.bundle, assets.goals, assets.mappings, async () => new Set());

test('第三批u49-t2：糖尿病分型答“不知道几型”后不重复追问，保留未知并说明边界', async () => {
  const base: any = {
    operationId: crypto.randomUUID(),
    messages: [{role: 'user', content: '我有糖尿病，晚餐食材怎么选？'}],
    diseases: ['糖尿病'],
    profile: {conditions: ['糖尿病'], goals: [], notes: ''},
  };
  const first: any = await researchFoodChat(base, content, provider());
  assert(first.message.content.includes('糖尿病分型'), first.message.content);

  const second: any = await researchFoodChat({
    ...base,
    profile: first.assessment.profile,
    messages: [
      ...base.messages,
      first.message,
      {role: 'user', content: '我不知道是几型，检查单现在不在身边。先告诉我能提供哪些帮助，不要再问同一个分型问题。'},
    ],
  }, content, provider());
  assert(!second.message.content.includes('还需确认：糖尿病分型'), second.message.content);
  assert(!second.message.content.includes('糖尿病分型（1型、2型或其他'), second.message.content);
  assert.match(second.message.content, /不再重复询问/);
  assert.match(second.message.content, /分型未知时不套用1型\/2型的具体指导/);
  const coverage: {input: string; status: string}[] = second.researchGuidance!.topicCoverage ?? [];
  assert(coverage.some(t => t.input === 'condition:糖尿病' && t.status === 'needs_topic_detail'));
});

test('第三批u49-t2：同义“不清楚是哪种分型”同样不循环追问', async () => {
  const base: any = {
    operationId: crypto.randomUUID(),
    messages: [{role: 'user', content: '我有糖尿病'}],
    diseases: ['糖尿病'],
    profile: {conditions: ['糖尿病'], goals: [], notes: ''},
  };
  const first: any = await researchFoodChat(base, content, provider());
  const second: any = await researchFoodChat({
    ...base,
    profile: first.assessment.profile,
    messages: [...base.messages, first.message, {role: 'user', content: '我不清楚是哪种分型'}],
  }, content, provider());
  assert(!second.message.content.includes('还需确认：糖尿病分型'), second.message.content);
  assert.match(second.message.content, /不再重复询问/);
});
