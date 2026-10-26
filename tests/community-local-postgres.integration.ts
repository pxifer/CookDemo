import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {connectDatabase} from '../server/db';
import {ContentRepository} from '../server/content-repository';
import {createApp} from '../server/app';
import {reviewedContent,REVIEWED_RELEASE} from '../scripts/lib/reviewed-content';
import {defaultMeal} from '../shared/types';
import {request} from './fixtures';

test('本机真实社区发布：只读应用账号回读、真实推荐、约束、固定量与旧版本回退',{
  skip:process.env.RUN_COMMUNITY_POSTGRES_TESTS!=='1',timeout:30000,
},async()=>{
  const url=new URL((await readFile('.local-data/deployment/db-app-url','utf8')).trim());
  assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'5432');assert.equal(url.username,'shiwei_app');
  url.pathname='/shiwei_business_local';const db=await connectDatabase(url.toString(),{max:2});
  const origin='http://127.0.0.1:4177';
  const app=await createApp({database:db,environment:'local',contentSource:'database',contentRelease:REVIEWED_RELEASE,origin});
  try{
    const repo=new ContentRepository(db),actual=await repo.load(REVIEWED_RELEASE),expected=await reviewedContent();
    const canonical=(recipes:typeof actual.recipes)=>recipes.map(r=>({...r,variants:r.variants.map(v=>({...v,lines:v.lines.map(l=>({...l,optional:!!l.optional}))}))})).sort((a,b)=>a.id.localeCompare(b.id));
    assert.equal(actual.contentState,'database-reviewed');assert.deepEqual(canonical(actual.recipes),canonical(expected.recipes));
    assert(actual.foods.every(f=>Object.keys(f.nutrition).length===0));
    const privilege=await db.query<{write:boolean}>("SELECT has_table_privilege(current_user,'catalog_recipes','INSERT') AS write");
    assert.equal(privilege.rows[0].write,false);
    const catalog=await app.inject('/api/v1/catalog/recipes');assert.equal(catalog.statusCode,200);
    assert.equal(catalog.json().contentVersion,REVIEWED_RELEASE);assert.equal(catalog.json().recipes.length,3);
    assert(catalog.json().recipes.every((r:any)=>r.source.kind==='community'&&r.source.reviewBasis==='source-and-structure'));
    const session=await app.inject('/api/v1/auth/session');
    const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin,'x-csrf-token':session.json().csrfToken};
    const meal=defaultMeal();meal.allowBuy=true;meal.mode='candidates';
    const calculate=async()=>{
      const response=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request(meal,{contentVersion:REVIEWED_RELEASE})});
      assert.equal(response.statusCode,200);return response.json();
    };
    const result=await calculate();assert.equal(result.dishes.length,3);
    assert(result.dishes.every((d:any)=>Object.values(d.nutrition).every(v=>v===null)));
    assert(result.dishes.every((d:any)=>d.recipe.imageUrl&&d.variant.steps.length>0));
    const amounts=(r:any)=>r.dishes.map((d:any)=>({id:d.recipe.id,lines:d.variant.lines})).sort((a:any,b:any)=>a.id.localeCompare(b.id));
    meal.servings=12;assert.deepEqual(amounts(await calculate()),amounts(result));
    meal.flavor='麻酱酸甜';assert.equal((await calculate()).dishes[0].recipe.id,'community-qianlong-cabbage');
    meal.flavor='不限';meal.restrictions=[{id:'egg',name:'鸡蛋',kind:'allergy',scope:'self',status:'confirmed',targets:['egg'],original:'鸡蛋过敏'}];
    assert(!(await calculate()).dishes.some((d:any)=>d.recipe.id==='community-spinach-eggs'));
    const mismatch=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:request(meal,{contentVersion:'local-business-ui-v2'})});
    assert.equal(mismatch.statusCode,409);
    const old=await repo.load('local-business-ui-v2');assert.equal(old.recipes.length,18);assert.equal(old.contentState,'database-constructed');
    assert.equal((await repo.load(REVIEWED_RELEASE)).recipes.length,3);
  }finally{await app.close();await db.close();}
});
