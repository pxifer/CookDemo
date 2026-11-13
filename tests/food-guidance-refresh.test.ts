import test from 'node:test';
import assert from 'node:assert/strict';
import {readFoodGuidanceAssets} from '../backend/src/rag/food-guidance-repository';
import {createFoodGuidanceProvider,bindRecipeGuidance} from '../backend/src/rag/food-guidance';
import {constructedContent} from '../shared/catalog';
import {contentContext} from '../shared/content';
import {simpleRecipe} from './fixtures';
import mappings from '../datasets/health/food-guidance-mappings-v3.json';

const current=await readFoodGuidanceAssets(),previous=await readFoodGuidanceAssets(2);
const names=[...new Set(mappings.membershipReview.map(r=>r.canonicalName))];
// Synthetic metadata for membership tests only, not a claim of complete ingredient composition.
const added=names.filter(name=>!constructedContent.foods.some(f=>f.name===name)).map((name,i)=>({id:`refresh-food-${i}`,name,aliases:[],unit:'g' as const,form:'raw' as const,allergens:[],componentsComplete:false,nutrition:{}}));
const content=contentContext({...constructedContent,foods:[...constructedContent.foods,...added]});
const profile={conditions:['高血压','高脂血症'],goals:['减脂'],notes:'我是成年人'};
const make=(assets:typeof current)=>createFoodGuidanceProvider(assets.bundle,assets.goals,assets.mappings,async()=>new Set());

test('映射v3只追加33个明确成员/35个对象归属，父版本不放宽或删除',()=>{
 assert.equal(current.mappings.id,'food-guidance-mappings-v3');assert.equal(names.length,33);assert.equal(mappings.membershipReview.length,35);
 for(const [id,row] of Object.entries(previous.mappings.objects)){
  const next=current.mappings.objects[id];assert(next);assert(row.names.every(n=>next.names.includes(n)));assert.equal(next.processRule,row.processRule);
 }
 assert.deepEqual(current.mappings.objects['f:low-fat-milk'],previous.mappings.objects['f:low-fat-milk']);
 assert(!current.mappings.objects['f:skinless-poultry'].names.includes('鸡肉'));
 assert(!current.mappings.objects['f:lean-meat'].names.includes('猪肉'));
 assert(!current.mappings.objects['f:tofu'].names.includes('日本豆腐'));
 assert(!current.mappings.objects['f:fish'].names.includes('虾'));
});

test('新增常用蔬菜/鱼/原味豆腐可按实际配料绑定，菜名或别名不能补造映射',async()=>{
 const [before,after]=await Promise.all([make(previous).prepare({profile,content}),make(current).prepare({profile,content})]);
 assert.notEqual(before.fingerprint,after.fingerprint);
 for(const name of ['娃娃菜','花菜','莲藕','黄花鱼','鳊鱼','内酯豆腐']){
  const id=content.foods.find(f=>f.name===name)!.id,recipe=simpleRecipe('实际配料-'+name,[[id,1]]);
  const a=bindRecipeGuidance(before,content,recipe,recipe.variants[0]),b=bindRecipeGuidance(after,content,recipe,recipe.variants[0]);
  assert(b.matches.some(m=>m.foodIds.includes(id)),name);assert(b.matches.length>a.matches.length,name);
 }
 const fake=simpleRecipe('娃娃菜莲藕鳊鱼但实际只有鸡蛋',[['egg',1]]);
 assert(!bindRecipeGuidance(after,content,fake,fake.variants[0]).matches.some(m=>['f:fresh-vegetables','f:fish','f:tofu'].includes(after.guidance.find(g=>g.id===m.guidanceId)!.objectId)));
 assert.equal(after.clinicalRelease,null);assert(after.guidance.every(g=>g.clinicalReview==='pending'));
});
