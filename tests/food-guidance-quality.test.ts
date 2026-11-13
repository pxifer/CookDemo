import test from 'node:test';
import assert from 'node:assert/strict';
import {readFoodGuidanceAssets} from '../backend/src/rag/food-guidance-repository';
import {createFoodGuidanceProvider,bindRecipeGuidance,reportedConditions} from '../backend/src/rag/food-guidance';
import {researchFoodChat,balancedFoodSuggestions} from '../backend/src/rag/food-guidance-chat';
import {constructedContent} from '../shared/catalog';
import {contentContext} from '../shared/content';
import {simpleRecipe} from './fixtures';
// Preserve the v2-specific regression independently of the current mapping default.
const assets=await readFoodGuidanceAssets(2);
const added=[...new Set(Object.values(assets.mappings.objects).flatMap(x=>x.names))].filter(name=>!constructedContent.foods.some(f=>f.name===name));
const content=contentContext({...constructedContent,foods:[...constructedContent.foods,...added.map((name,i)=>({id:`quality-food-${i}`,name,aliases:[],unit:'g' as const,form:'raw' as const,allergens:[],componentsComplete:true,nutrition:{}}))]});
const profile={conditions:['高脂血症'],goals:[],notes:'我是成年人'};
const provider=()=>createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set());
test('20条展示按方向及主题/对象轮转，不被同一蔬菜类别挤满；被限制食材不会混入',async()=>{
 const packet=await provider().prepare({profile,content,conditions:{lipidPattern:'high_cholesterol'}}),salt=content.foods.find(f=>f.name==='盐')!.id;
 const result=balancedFoodSuggestions(packet,content,[salt]);assert.equal(result.length,20);assert(!result.some(s=>s.foodName==='盐'));
 assert(result.some(s=>s.direction==='limit'));assert(result.some(s=>s.direction==='prefer'&&s.foodName.includes('鱼')));assert(result.some(s=>s.foodName.includes('低脂')));
 const vegetableNames=assets.mappings.objects['f:fresh-vegetables'].names;assert(result.filter(s=>vegetableNames.includes(s.foodName)).length<10);
 assert.deepEqual(result,balancedFoodSuggestions(packet,content,[salt]));assert.equal(new Set(result.map(s=>`${s.foodName}:${s.direction}:${s.topics}`)).size,result.length);
 assert.equal(balancedFoodSuggestions(packet,content,[],0).length,0);
});
test('血脂分型补问可实际回答；不知道保留未知，不循环补问或以“是”当成分型',async()=>{
 let request:any={operationId:crypto.randomUUID(),messages:[{role:'user',content:'我是成年人，我有高脂血症'}],diseases:[],profile};
 let reply=await researchFoodChat(request,content,provider());assert(reply.message.content.includes('血脂异常分型'));assert(!reply.message.content.includes('该项建议所需'));
 const first=reply;
 request={...request,profile:reply.assessment!.profile,messages:[...request.messages,reply.message,{role:'user',content:'高胆固醇'}]};
 reply=await researchFoodChat(request,content,provider());assert.equal(reply.researchGuidance!.guidance.find(g=>g.factId==='fact:lipid-limit-liver')!.applicability,'applicable');
 const unknown=await researchFoodChat({...request,profile:first.assessment!.profile,messages:[{role:'user',content:'我是成年人，我有高脂血症'},first.message,{role:'user',content:'不清楚'}]},content,provider());
 assert(!unknown.message.content.includes('还需确认：血脂异常分型'));assert(unknown.researchGuidance!.missingConditions.includes('lipidPattern'));assert.equal(unknown.researchGuidance!.guidance.find(g=>g.factId==='fact:lipid-limit-liver')!.applicability,'needs_confirmation');
 assert.equal(reportedConditions('我看网上说高胆固醇').lipidPattern,undefined);assert.equal(reportedConditions('我已知血脂分型是高甘油三酯').lipidPattern,'high_triglycerides');
});
test('映射v2只补明确白菜心成员；v1保留，变更指纹；不凭菜名绑定或推断整菜健康',async()=>{
 const old=await readFoodGuidanceAssets(1),oldProvider=createFoodGuidanceProvider(old.bundle,old.goals,old.mappings,async()=>new Set());
 const [before,after]=await Promise.all([oldProvider.prepare({profile,content}),provider().prepare({profile,content})]);assert.notEqual(before.fingerprint,after.fingerprint);
 const heart=content.foods.find(f=>f.name==='白菜心')!.id,recipe=simpleRecipe('白菜心测试',[[heart,1]]);
 assert(!bindRecipeGuidance(before,content,recipe,recipe.variants[0]).matches.some(m=>m.foodIds.includes(heart)));
 assert(bindRecipeGuidance(after,content,recipe,recipe.variants[0]).matches.some(m=>m.foodIds.includes(heart)));
 const fakeName=simpleRecipe('白菜心但实际配方只有鸡蛋',[['egg',1]]);assert(!bindRecipeGuidance(after,content,fakeName,fakeName.variants[0]).matches.some(m=>m.foodIds.includes(heart)));
 assert.equal(after.clinicalRelease,null);assert(after.guidance.every(g=>g.clinicalReview==='pending'));
});
