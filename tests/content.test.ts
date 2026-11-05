import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate, type Database } from '../backend/src/db';
import { ContentRepository } from '../backend/src/content-repository';
import { businessFixture } from './content-fixture';
import { contentContext } from '../shared/content';
import { extractText } from '../shared/extraction';
import { recommend } from '../backend/src/recommendation';
import { request, simpleRecipe } from './fixtures';
import { defaultMeal } from '../shared/types';
import { createApp } from '../backend/src/app';
import { constructedContent } from '../shared/catalog';

async function embedded() {
  const engine = new PGlite();
  const db: Database = { query:(sql,params) => engine.query(sql,params),exec:async sql => { await engine.exec(sql); },close:() => engine.close() };
  await migrate(db); return db;
}
test('内容导入保持草稿隔离，发布后读取食材/营养/步骤/变体，不回退源码目录', async () => {
  const db = await embedded();
  try {
    const repo = new ContentRepository(db), fixture = businessFixture();
    await repo.importDraft(fixture);
    await assert.rejects(repo.load(fixture.contentVersion), { code:'CONTENT_NOT_READY' });
    await repo.publish(fixture.contentVersion);
    const snapshot = await repo.load(fixture.contentVersion), context = contentContext(snapshot);
    assert.equal(snapshot.recipes.length,18); assert.equal(context.findFood('构造角瓜')?.id,'local-zucchini');
    assert.equal(snapshot.recipes.find(r => r.id === 'local-zucchini')?.variants[1].steps.length,1);
    const meal = defaultMeal(); meal.ingredients = extractText('构造角瓜200g',context).ingredients.map(i => ({...i,status:'confirmed',basis:'edible'}));
    const result = await recommend(snapshot.recipes,request(meal),{context});
    assert.equal(result.dishes.length,1); assert.equal(result.contentVersion,fixture.contentVersion);
    assert.deepEqual(result.dishes[0].nutrition,{kcal:20,protein:2,sodium:null});
    assert.equal(result.dishes[0].variant.lines[0].amount,100);
    await assert.rejects(repo.importDraft(fixture),{code:'CONTENT_VERSION_EXISTS'});
  } finally { await db.close(); }
});
test('非法内容与中途SQL失败整体回滚；发布失败仍为草稿；撤回后不能发布或回滚复活', async () => {
  const db = await embedded();
  try {
    const repo = new ContentRepository(db), bad = businessFixture('bad-main');
    bad.recipes[0].variants[1].lines[0] = { ...bad.recipes[0].variants[1].lines[0], foodId:'beef' };
    await assert.rejects(repo.importDraft(bad),{code:'CONTENT_INVALID'});
    const faulty: Database = { ...db, query:async (sql,params) => {
      if (sql.startsWith('INSERT INTO catalog_variant_steps')) throw new Error('synthetic insert interruption');
      return db.query(sql,params);
    } };
    await assert.rejects(new ContentRepository(faulty).importDraft(businessFixture('broken-import')),{code:'CONTENT_DATABASE_UNAVAILABLE'});
    assert.equal((await db.query('SELECT id FROM public_releases')).rows.length,0);
    await repo.importDraft(businessFixture('draft-a'));
    await db.query("UPDATE content_sources SET state='withdrawn' WHERE id='draft-a:nutrition'");
    await assert.rejects(repo.publish('draft-a'),{code:'CONTENT_SOURCE_UNAVAILABLE'});
    assert.equal((await db.query<{state:string}>("SELECT state FROM catalog_releases WHERE id='draft-a'")).rows[0].state,'draft');
    await repo.importDraft(businessFixture('release-b')); await repo.publish('release-b'); await repo.withdraw('release-b');
    await assert.rejects(repo.load('release-b'));
    await assert.rejects(repo.publish('release-b'),{code:'CONTENT_WITHDRAWN'});
  } finally { await db.close(); }
});
test('数据库内容错误有明确503/409，空内容、来源撤回和数据篡改不返回构造备用结果', async () => {
  const db = await embedded();
  const app = await createApp({database:db,environment:'local',contentSource:'database',contentRelease:'api-content'});
  try {
    assert.equal((await app.inject('/api/v1/catalog/recipes')).statusCode,503);
    const repo = new ContentRepository(db); await repo.importDraft(businessFixture('api-content')); await repo.publish('api-content');
    const session = await app.inject('/api/v1/auth/session'); const auth = session.json();
    const headers = {cookie:String(session.headers['set-cookie']).split(';')[0],origin:'http://localhost:80','x-csrf-token':auth.csrfToken};
    const mismatch = await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:{...request(),contentVersion:'old'}});
    assert.equal(mismatch.statusCode,409); assert.equal(mismatch.json().error.code,'CONTENT_CHANGED');
    await db.query(`INSERT INTO catalog_nutrition(release_id,food_id,nutrient,value,unit,source_id,source_version,source_record_id)
      SELECT release_id,food_id,nutrient,value,unit,'api-content:recipe','1','ambiguous' FROM catalog_nutrition
      WHERE release_id='api-content' AND food_id='local-zucchini' AND nutrient='kcal'`);
    const ambiguous=await app.inject('/api/v1/catalog/recipes');assert.equal(ambiguous.statusCode,503);
    assert.ok(['CONTENT_NUTRITION_AMBIGUOUS','CONTENT_SOURCE_UNAVAILABLE'].includes(ambiguous.json().error.code));
    await db.query("DELETE FROM catalog_nutrition WHERE release_id='api-content' AND source_id='api-content:recipe'");
    await db.query("DELETE FROM catalog_variant_steps WHERE release_id='api-content' AND variant_id='local-zucchini-light'");
    const missing=await app.inject('/api/v1/catalog/recipes');assert.equal(missing.statusCode,503);assert.equal(missing.json().error.code,'CONTENT_INTEGRITY_INVALID');
    for(const [position,step] of businessFixture().recipes.find(r=>r.id==='local-zucchini')!.variants[0].steps.entries())
      await db.query("INSERT INTO catalog_variant_steps VALUES('api-content','local-zucchini-light',$1,$2)",[position,step]);
    await db.query("UPDATE catalog_variant_steps SET instruction='tampered' WHERE release_id='api-content'");
    const invalid = await app.inject('/api/v1/catalog/recipes'); assert.equal(invalid.statusCode,503); assert.equal(invalid.json().error.code,'CONTENT_INTEGRITY_INVALID');
  } finally { await app.close(); await db.close(); }
});
test('并行内容上下文不污染全局目录；成分包含限制及跨版本游标有效',async () => {
  const a=contentContext(businessFixture('context-a')), bData=businessFixture('context-b');
  bData.foods.push({id:'local-blend',name:'构造混合料',aliases:[],unit:'g',form:'raw',allergens:[],componentsComplete:true,nutrition:{kcal:60,protein:2}});
  bData.relations=[{foodId:'local-blend',relatedFoodId:'local-zucchini',kind:'contains'}];
  for(const v of bData.recipes.find(r=>r.id==='local-zucchini')!.variants)v.lines[0]={...v.lines[0],foodId:'local-blend'};
  const b=contentContext(bData), mealA=defaultMeal(), mealB=defaultMeal();
  mealA.ingredients=extractText('构造角瓜200g',a).ingredients.map(i=>({...i,status:'confirmed',basis:'edible'}));
  mealB.ingredients=extractText('构造混合料200g',b).ingredients.map(i=>({...i,status:'confirmed',basis:'edible'}));
  const [resultA,resultB]=await Promise.all([recommend(a.recipes,request(mealA),{context:a}),recommend(b.recipes,request(mealB),{context:b})]);
  assert.equal(resultA.dishes[0].nutrition.kcal,20);assert.equal(resultB.dishes[0].nutrition.kcal,60);
  assert.equal(constructedContent.foodById.has('local-blend'),false);
  await assert.rejects(recommend(b.recipes,request(mealB,{cursor:resultA.cursor}),{context:b}),{code:'CURSOR_EXPIRED'});
  mealB.restrictions=[{id:'avoid',kind:'avoid',name:'构造西葫芦',targets:['local-zucchini'],scope:'self',status:'confirmed',original:'构造西葫芦'}];
  assert.equal((await recommend(b.recipes,request(mealB),{context:b})).dishes.length,0);
});
test('工作台目录与文本识别API共享运行时粉条词条',async()=>{
  const app=await createApp();
  try{
    const session=await app.inject('/api/v1/auth/session'),auth=session.json();
    const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'http://localhost:80','x-csrf-token':auth.csrfToken};
    const catalog=await app.inject({url:'/api/v1/catalog/recipes',headers});
    assert.equal(catalog.statusCode,200);
    assert.ok(catalog.json().foods.some((food:{id:string})=>food.id==='ingredient-family-vermicelli'));
    const extracted=await app.inject({method:'POST',url:'/api/v1/recognitions/text',headers,payload:{text:'猪肉，白菜，粉条',contentVersion:catalog.json().contentVersion}});
    assert.equal(extracted.statusCode,200);
    assert.deepEqual(extracted.json().ingredients.map((item:{name:string})=>item.name),['猪肉','白菜','粉条']);
    assert.deepEqual(extracted.json().unresolved,[]);
    const meal=defaultMeal();meal.mode='candidates';meal.allowBuy=true;
    meal.ingredients=extracted.json().ingredients.map((item:ReturnType<typeof extractText>['ingredients'][number])=>({...item,status:'confirmed' as const}));
    const recommendation=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request(meal,{contentVersion:catalog.json().contentVersion})});
    assert.equal(recommendation.statusCode,200,'the server accepts the broad token with its unspecified form');
  }finally{await app.close();}
});
test('食材局部名称经真实API识别后可直接提交推荐，不再报输入格式错误',async()=>{
  const db=await embedded(),fixture=businessFixture('partial-input-api');
  fixture.foods.push({id:'low-gluten-flour',name:'低筋面粉',aliases:[],unit:'g',form:'raw',allergens:[],componentsComplete:true,nutrition:{}});
  fixture.recipes.push(simpleRecipe('flour-cake',[['low-gluten-flour',100]]));
  const repo=new ContentRepository(db);await repo.importDraft(fixture);await repo.publish(fixture.contentVersion);
  const app=await createApp({database:db,environment:'local',contentSource:'database',contentRelease:fixture.contentVersion});
  try{
    const session=await app.inject('/api/v1/auth/session'),auth=session.json();
    const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'http://localhost:80','x-csrf-token':auth.csrfToken};
    const catalog=(await app.inject('/api/v1/catalog/recipes')).json();
    const extracted=await app.inject({method:'POST',url:'/api/v1/recognitions/text',headers,payload:{text:'面粉200g',contentVersion:catalog.contentVersion}});
    assert.equal(extracted.statusCode,200);
    const item=extracted.json().ingredients[0];assert.match(item.foodId,/^pantry-query-/);assert.equal(item.form,'unspecified');
    const meal={...defaultMeal(),ingredients:[{...item,status:'confirmed'}]};
    const response=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request(meal,{contentVersion:catalog.contentVersion})});
    assert.equal(response.statusCode,200);
    assert.equal(response.json().dishes[0].recipe.id,'flour-cake');
    const invalid=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request({...meal,ingredients:[{...meal.ingredients[0],foodId:'pantry-query-forged'}]})});
    assert.equal(invalid.statusCode,400);assert.equal(invalid.json().error.code,'INVALID_INGREDIENT');
  }finally{await app.close();await db.close();}
});
