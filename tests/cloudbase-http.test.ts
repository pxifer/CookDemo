import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { reviewedContent } from '../scripts/lib/reviewed-content';
import { curateCandidate } from '../scripts/lib/candidate-curation';
import { CloudBaseGalleryRepository, galleryBundleHash, type GalleryBundle } from '../backend/src/cloudbase-content';
import { createApp } from '../backend/src/app';
import { GALLERY_RELEASE, galleryContent } from '../backend/src/gallery-content';
import methodReview from '../datasets/recipes/curation/recipe-step-review-v28.json';
import { defaultMeal } from '../shared/types';
import { PGlite } from '@electric-sql/pglite';

async function fixture():Promise<GalleryBundle>{
  const read=async(path:string)=>(await readFile(path,'utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line));
  const cards=[...(await read('datasets/recipes/curation/recipe-cards-v3.jsonl')).filter(c=>c.source==='howtocook'&&c.completeness==='full_process'),...await read('datasets/recipes/curation/recipe-candidates-supplement-v1.jsonl')];
  return{base:await reviewedContent(),rows:cards.map(card=>{const r=curateCandidate(card)?.record??card;return{dish_key:r.dish_key,flavor:r.flavor,source_uri:r.url,image_url:null,raw_record:r};})};
}
test('免费HTTP适配：PG只读公开内容→真实145菜→同源会话/推荐；原硬限制保留',async()=>{
  const bundle=await fixture();
  const publicRow=bundle.rows.find(row=>!bundle.base.recipes.some(recipe=>recipe.name===row.dish_key))!;
  publicRow.source_uri='https://recipes.example/public-recipe';publicRow.raw_record.author='公开出处 · 公开配方资料；保留原始出处';publicRow.raw_record.license='公开配方资料；保留原始出处';publicRow.raw_record.review_notes=['未试做'];
  publicRow.raw_record.seasonings=['盐（用量未注明）','食用油：原页未注明用量','白糖5g'];
  publicRow.raw_record.steps=['按原简介制作'];
  publicRow.raw_record.method_options=[{label:'先煎（待核）',steps:['来源此支煎熟。']}];
  let published=true;let payloadReads=0,publicationChecks=0;
  const fetcher:typeof fetch=async(input,init)=>{const url=String(input);assert(url.startsWith('https://shiwei-test.api.tcloudbasegateway.com/v1/rdb/rest/shiwei_gallery_releases?'));assert.equal(init?.redirect,'error');if(url.includes('select=release_id')){publicationChecks++;return new Response(JSON.stringify(published?[{release_id:'test-release'}]:[]));}payloadReads++;return new Response(JSON.stringify(published?[{payload:bundle}]:[]));};
  const repository=new CloudBaseGalleryRepository({envId:'shiwei-test',publishableKey:'public-test-key',releaseId:'test-release',hash:galleryBundleHash(bundle),fetch:fetcher});
  const app=await createApp({environment:'preview',origin:'https://shiwei.example',contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,sessionSecret:randomBytes(32),csrfSecret:randomBytes(32),contentRepository:repository});
  try{
    assert.equal((await app.inject('/readyz')).json().status,'preview_ready');
    const catalog=(await app.inject('/api/v1/catalog/recipes')).json();assert.equal(catalog.recipes.length,145);assert.equal('contentState' in catalog,false);assert.equal('source' in catalog.recipes[0],false);
    const publicRecipe=catalog.recipes.find((recipe:any)=>recipe.name===publicRow.dish_key);
    assert.deepEqual(publicRecipe.publicAttribution,{label:'公开出处',url:publicRow.source_uri});
    assert.equal('reviewNotes' in publicRecipe.variants[0],false);
    assert.doesNotMatch(JSON.stringify(publicRecipe),/公开配方资料；保留原始出处|按原简介/);
    assert.deepEqual(publicRecipe.variants[0].methodOptions[0],{label:'先煎',steps:['煎熟。']});
    const gallery=(await app.inject('/api/v1/local/candidate-recipes')).json();assert.equal(gallery.recipes.length,147);
    const publicCandidate=gallery.recipes.find((row:any)=>row.dish_key===publicRow.dish_key);
    assert.deepEqual(publicCandidate.publicAttribution,{label:'公开出处',url:publicRow.source_uri});
    assert.equal('author' in publicCandidate.raw_record,false);assert.equal('license' in publicCandidate.raw_record,false);assert.equal('review_notes' in publicCandidate.raw_record,false);
    assert.deepEqual(publicCandidate.raw_record.seasonings,['盐','食用油','白糖5g']);
    assert.deepEqual(publicCandidate.raw_record.method_options[0],{label:'先煎',steps:['煎熟。']});
    assert.doesNotMatch(JSON.stringify({catalog,gallery}),/内部许可核验|未试做|公开配方资料；保留原始出处|按原简介/);
    const validatedPayloadReads=payloadReads;
    const session=await app.inject('/api/v1/auth/session');assert(String(session.headers['set-cookie']).includes('Secure'));assert.equal(session.json().accountAvailable,false);
    const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'https://shiwei.example','x-csrf-token':session.json().csrfToken};
    const response=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:{operationId:'http-preview-test',meal:{...defaultMeal(),mode:'candidates',allowBuy:true},action:'generate',page:0,selected:[],previous:[],contentVersion:catalog.contentVersion}});
    assert.equal(response.statusCode,200);assert.equal(response.json().dishes.length,6);
    assert.equal('source' in response.json().dishes[0].recipe,false);assert.equal('reviewNotes' in response.json().dishes[0].recipe.variants[0],false);
    assert.equal(payloadReads,validatedPayloadReads,'翻页推荐复用已验证的不可变发布payload');
    assert(publicationChecks>=2,'复用内容前及结果发布前仍需实时确认发布未撤回');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/recommendations',headers:{...headers,origin:'https://untrusted.example'},payload:{operationId:'forged-origin',meal:{...defaultMeal(),allowBuy:true},action:'generate',page:0,selected:[],previous:[]}})).statusCode,403);
    published=false;assert.equal((await app.inject('/api/v1/catalog/recipes')).statusCode,503);assert.equal((await app.inject('/readyz')).statusCode,503);
  }finally{await app.close();}
});
test('已细化的原方步骤同时用于图鉴、目录及工作台做法，食材数据保持原值',async()=>{
  const records=(await readFile('datasets/recipes/curation/recipe-cards-v3.jsonl','utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line));
  const card=records.find(row=>row.id==='R111');assert(card);
  const row={dish_key:card.dish_key,flavor:card.flavor,source_uri:card.url,image_url:null,raw_record:card};
  const snapshot=galleryContent(await reviewedContent(),[row]);
  const original=snapshot.recipes.find(recipe=>recipe.name===card.dish_key)!;
  const app=await createApp({environment:'preview',origin:'https://shiwei.example',contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,
    sessionSecret:randomBytes(32),csrfSecret:randomBytes(32),contentRepository:{load:async()=>snapshot,candidates:async()=>[row]}});
  try{
    const catalog=(await app.inject('/api/v1/catalog/recipes')).json();
    const recipe=catalog.recipes.find((recipe:any)=>recipe.name===card.dish_key);
    assert.deepEqual(recipe.variants[0].steps,methodReview.recipes.R111.steps);
    assert.deepEqual(recipe.variants[0].lines.map(({sourceText,...line}:any)=>line),original.variants[0].lines.map(({sourceText,...line})=>line));
    const gallery=(await app.inject('/api/v1/local/candidate-recipes')).json();
    assert.deepEqual(gallery.recipes[0].raw_record.steps,methodReview.recipes.R111.steps);
    const session=await app.inject('/api/v1/auth/session');
    const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'https://shiwei.example','x-csrf-token':session.json().csrfToken};
    const response=await app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:{operationId:'method-copy',meal:{...defaultMeal(),mode:'candidates',allowBuy:true},action:'generate',page:0,selected:[],previous:[],contentVersion:catalog.contentVersion}});
    assert.equal(response.statusCode,200);
    const dish=response.json().dishes.find((dish:any)=>dish.recipe.id===original.id);assert(dish);
    assert.deepEqual(dish.variant.steps,methodReview.recipes.R111.steps);
  }finally{await app.close();}
});
test('公开菜谱撤回、篡改、网络失败不回退构造内容；不能把测试账号或生产模式接到预览',async()=>{
  const bundle=await fixture();
  const repository=new CloudBaseGalleryRepository({envId:'shiwei-test',publishableKey:'public-test-key',releaseId:'test-release',hash:'0'.repeat(64),fetch:async()=>new Response(JSON.stringify([{payload:bundle}]))});
  await assert.rejects(repository.load(GALLERY_RELEASE),{code:'CONTENT_NOT_READY'});
  for(const environment of ['local','production'] as const)await assert.rejects(createApp({environment,contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,contentRepository:repository}));
});
test('分页游标可跨无共享内存的 HTTP 函数实例验证',async()=>{
  const bundle=await fixture(),sessionSecret=randomBytes(32),csrfSecret=randomBytes(32);
  const makeApp=async()=>{
    const fetcher:typeof fetch=async(input)=>String(input).includes('select=release_id')
      ?new Response(JSON.stringify([{release_id:'test-release'}]))
      :new Response(JSON.stringify([{payload:bundle}]));
    const repository=new CloudBaseGalleryRepository({envId:'shiwei-test',publishableKey:'public-test-key',releaseId:'test-release',hash:galleryBundleHash(bundle),fetch:fetcher});
    return createApp({environment:'preview',origin:'https://shiwei.example',sessionSecret,csrfSecret,contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,contentRepository:repository});
  };
  const firstInstance=await makeApp(),secondInstance=await makeApp();
  try{
    const catalog=(await firstInstance.inject('/api/v1/catalog/recipes')).json();
    const session=await firstInstance.inject('/api/v1/auth/session');
    const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin:'https://shiwei.example','x-csrf-token':session.json().csrfToken};
    const meal={...defaultMeal(),mode:'candidates' as const,allowBuy:true};
    const first=await firstInstance.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:{operationId:'instance-one-generation',meal,action:'generate',page:0,selected:[],previous:[],contentVersion:catalog.contentVersion}});
    assert.equal(first.statusCode,200);const initial=first.json();assert.equal(initial.page,0);assert(initial.cursor);
    const next=await secondInstance.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:{operationId:'instance-two-next-page',meal,action:'page',page:1,cursor:initial.cursor,selected:[],previous:[],contentVersion:catalog.contentVersion}});
    assert.equal(next.statusCode,200);assert.equal(next.json().page,1);assert.equal(next.json().dishes.length,6);
    assert.notDeepEqual(next.json().dishes.map((dish:any)=>dish.recipe.id),initial.dishes.map((dish:any)=>dish.recipe.id));
  }finally{await Promise.all([firstInstance.close(),secondInstance.close()]);}
});
test('公开菜谱表权限：匿名仅可读已发布payload，不能读取checksum、修改发布或访问账号表',async()=>{
  const db=new PGlite();
  try{
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE accounts(secret text);');
    await db.exec(await readFile('deployment/db/gallery-http-release.sql','utf8'));
    await db.query('INSERT INTO shiwei_gallery_releases(release_id,checksum,payload,published) VALUES($1,$2,$3,true),($4,$2,$3,false)',['visible','a'.repeat(64),{},'hidden']);
    await db.exec('SET ROLE anon');
    assert.equal((await db.query('SELECT payload FROM shiwei_gallery_releases')).rows.length,1);
    await assert.rejects(db.query('SELECT checksum FROM shiwei_gallery_releases'));
    await assert.rejects(db.query('UPDATE shiwei_gallery_releases SET published=true'));
    await assert.rejects(db.query('SELECT * FROM accounts'));
  }finally{await db.close();}
});

test('不可变明列食材发布包读取时应用独立配图，工作台与图鉴一致且不改发布包',async()=>{
  const bundle=await fixture();
  const snapshot=galleryContent(bundle.base,bundle.rows);
  snapshot.restrictionScope='listed-foods';
  delete snapshot.compositionApprovals;delete snapshot.unresolvedComponents;delete snapshot.uncertainComponents;
  const target=snapshot.recipes.find(recipe=>recipe.name==='柱候牛腩')!;assert(target);
  target.imageUrl=undefined;
  const variants=snapshot.recipes.flatMap(recipe=>recipe.variants);
  for(const variant of variants)for(const line of variant.lines)line.sourceText??=snapshot.foods.find(food=>food.id===line.foodId)!.name;
  bundle.listedFoodSnapshot=snapshot;
  bundle.foodLevelReview={version:'listed-foods-v1',recipes:snapshot.recipes.length,variants:variants.length,ingredientRows:variants.reduce((n,variant)=>n+variant.lines.length,0),checkedAt:'2026-10-27'};
  const unchanged=JSON.stringify(bundle);
  const fetcher:typeof fetch=async input=>new Response(JSON.stringify(String(input).includes('select=release_id')?[{release_id:'images-test'}]:[{payload:bundle}]));
  const repository=new CloudBaseGalleryRepository({envId:'shiwei-test',publishableKey:'test-public',releaseId:'images-test',hash:galleryBundleHash(bundle),fetch:fetcher});
  const actual=await repository.load(GALLERY_RELEASE),rows=await repository.candidates();
  const recipe=actual.recipes.find(recipe=>recipe.id===target.id)!;
  assert.match(recipe.imageUrl!,/^https:\/\/[^/]+\/assets\/recipes\//);
  assert(rows.filter(row=>row.dish_key===target.name).every(row=>row.image_url===recipe.imageUrl));
  assert.equal(actual.contentVersion,snapshot.contentVersion);
  assert.equal(JSON.stringify(bundle),unchanged);
});
