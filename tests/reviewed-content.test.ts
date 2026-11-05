import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate, type Database } from '../backend/src/db';
import { ContentRepository } from '../backend/src/content-repository';
import { reviewedContent } from '../scripts/lib/reviewed-content';
import { contentContext } from '../shared/content';
import { defaultMeal } from '../shared/types';
import { recommend } from '../backend/src/recommendation';
import { request } from './fixtures';

test('真实社区资料只导入核过的用量步骤，不导入构造营养或简介功效',async()=>{
  const snapshot=await reviewedContent();
  assert.equal(snapshot.contentState,'database-reviewed');assert.equal(snapshot.recipes.length,3);
  assert(snapshot.foods.every(f=>Object.keys(f.nutrition).length===0));assert(!snapshot.foods.some(f=>f.id==='local-zucchini'));
  assert(snapshot.recipes.every(r=>r.source.kind==='community'&&r.source.reviewed&&r.source.reviewBasis==='source-and-structure'&&r.imageUrl));
  const cabbage=snapshot.recipes.find(r=>r.id==='community-qianlong-cabbage')!;
  assert.equal(cabbage.variants[0].flavor,'麻酱酸甜');assert.equal(cabbage.minutes,10);assert.equal(cabbage.servings,2);
  assert.equal(cabbage.variants[0].lines.find(l=>l.foodId==='aged-vinegar')!.amount,45);
  assert(snapshot.recipes.flatMap(r=>r.variants.flatMap(v=>v.lines)).every(l=>l.basis==='unknown'));
  assert(!snapshot.recipes.flatMap(r=>r.variants.flatMap(v=>v.steps)).some(s=>/补血养气|增强体质|预估卡路里/.test(s)));
});
test('社区来源经事务发布回读；撤证据立即失效，拒绝伪造reviewed标记',async()=>{
  const engine=new PGlite();
  const db:Database={query:(sql,params)=>engine.query(sql,params),exec:async sql=>{await engine.exec(sql);},close:()=>engine.close()};
  try{
    await migrate(db);const repo=new ContentRepository(db),input=await reviewedContent();
    const forged=structuredClone(input);forged.contentVersion='bad-review';delete forged.recipes[0].source.reviewBasis;
    await assert.rejects(repo.importDraft(forged),{code:'CONTENT_INVALID'});
    await repo.importDraft(input);await assert.rejects(repo.load(input.contentVersion),{code:'CONTENT_NOT_READY'});
    await repo.publish(input.contentVersion);const snapshot=await repo.load(input.contentVersion),context=contentContext(snapshot);
    assert.equal(snapshot.contentState,'database-reviewed');assert.deepEqual(snapshot.sourceEvidence,input.sourceEvidence);
    assert.deepEqual(snapshot.recipes.find(r=>r.id==='community-qianlong-cabbage')!.source,input.recipes.find(r=>r.id==='community-qianlong-cabbage')!.source);
    const meal={...defaultMeal(),allowBuy:true};
    const all=await recommend(snapshot.recipes,request(meal),{context});assert.equal(all.dishes.length,3);assert(all.dishes.every(d=>Object.values(d.nutrition).every(v=>v===null)));
    meal.mode='candidates';meal.flavor='麻酱酸甜';assert.equal((await recommend(snapshot.recipes,request(meal),{context})).dishes[0].recipe.id,'community-qianlong-cabbage');
    meal.restrictions=[{id:'egg',name:'鸡蛋',kind:'allergy',scope:'self',status:'confirmed',targets:['egg'],original:'鸡蛋过敏'}];meal.flavor='不限';
    const filtered=await recommend(snapshot.recipes,request(meal),{context});assert(!filtered.dishes.some(d=>d.recipe.id==='community-spinach-eggs'));
    await db.query("UPDATE content_sources SET license_evidence='tampered' WHERE id=$1",[`${input.contentVersion}:recipe`]);
    await assert.rejects(repo.load(input.contentVersion),{code:'CONTENT_SOURCE_UNAVAILABLE'});
  }finally{await db.close();}
});
