import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectDatabase, migrate, type Database } from '../server/db';
import { ContentRepository } from '../server/content-repository';
import { createApp } from '../server/app';
import { businessFixture } from './content-fixture';
import { contentContext } from '../shared/content';
import { extractText } from '../shared/extraction';
import { defaultMeal } from '../shared/types';
import { request } from './fixtures';
import {reviewedContent} from '../scripts/lib/reviewed-content';

test('真实PostgreSQL本地业务：事务导入/发布/版本回退、API读取/推荐、故障与撤回', {
  skip:process.env.RUN_BUSINESS_POSTGRES_TESTS !== '1',timeout:120000,
},async t => {
  const docker = [process.env.DOCKER_EXE,join(process.env.LOCALAPPDATA ?? '','Programs/DockerDesktop/resources/bin/docker.exe'),
    'C:/Program Files/Docker/Docker/resources/bin/docker.exe'].find(p => p && existsSync(p));
  assert.ok(docker);
  const run = (args: string[]) => {
    const r = spawnSync(docker!,args,{encoding:'utf8',timeout:30000,windowsHide:true});
    assert.equal(r.status,0,'Local Docker operation must succeed'); return r.stdout.trim();
  };
  const context = run(['context','show']);
  assert.match(run(['context','inspect',context,'--format','{{.Endpoints.docker.Host}}']),/^(npipe|unix):\/\//);
  assert.equal(run(['inspect','shiwei-local-db-1','--format','{{index .Config.Labels "com.docker.compose.project"}}']),'shiwei-local');
  const database = `shiwei_business_test_${randomUUID().replace(/-/g,'')}`;
  const ownerUrl = new URL((await readFile('.local-data/deployment/db-owner-url','utf8')).trim());
  const runtimeUrl = new URL((await readFile('.local-data/deployment/db-app-url','utf8')).trim());
  assert.equal(ownerUrl.hostname,'127.0.0.1'); assert.equal(runtimeUrl.hostname,'127.0.0.1');
  ownerUrl.pathname = runtimeUrl.pathname = `/${database}`;
  let created = false;
  let db: Database | undefined, runtime: Database | undefined;
  const apps: Awaited<ReturnType<typeof createApp>>[] = [];
  const completed: string[] = [];
  try {
    run(['exec','shiwei-local-db-1','createdb','-U','postgres','-O','shiwei_owner','-T','template0',database]); created=true;
    db = await connectDatabase(ownerUrl.toString(),{max:4}); await migrate(db);
    const repo = new ContentRepository(db);
    await t.test('真实空库内容为503，结构和进程可用不冒充业务就绪',async () => {
      const empty=await createApp({database:db,environment:'local',contentSource:'database',contentRelease:'local-business-missing'});apps.push(empty);
      assert.equal((await empty.inject('/healthz')).statusCode,200);
      assert.equal((await empty.inject('/deploymentz')).statusCode,200);
      assert.equal((await empty.inject('/readyz')).statusCode,503);
      const response=await empty.inject('/api/v1/catalog/recipes');assert.equal(response.statusCode,503);assert.equal(response.json().error.code,'CONTENT_NOT_READY');
      completed.push('empty-content-not-ready');
    });
    await t.test('草稿不对外读取，导入/发布回读通过；运行账号仅可读内容',async () => {
      await repo.importDraft(businessFixture('local-business-a'));
      await assert.rejects(repo.load('local-business-a'),{code:'CONTENT_NOT_READY'});
      await repo.publish('local-business-a');
      const loaded = await repo.load('local-business-a');
      assert.equal(loaded.recipes.length,18); assert.equal(loaded.recipes.reduce((n,r) => n+r.variants.length,0),36);
      assert.equal(loaded.foods.find(f => f.id === 'local-zucchini')?.nutritionSources?.kcal?.unit,'kcal');
      await db!.exec('GRANT USAGE ON SCHEMA public TO shiwei_app; GRANT SELECT ON ALL TABLES IN SCHEMA public TO shiwei_app;');
      runtime = await connectDatabase(runtimeUrl.toString(),{max:4});
      assert.equal((await new ContentRepository(runtime).load('local-business-a')).contentVersion,'local-business-a');
      await assert.rejects(runtime.query("UPDATE catalog_recipes SET name='forbidden' WHERE release_id='local-business-a'"),{code:'42501'});
      completed.push('import-publish-readonly');
    });
    await t.test('中途插入失败整体回滚，发布失败不留下半发布状态',async () => {
      const faulty: Database = { ...db!, withSession:work => db!.withSession!(session => work({ ...session, query:async (sql,params) => {
        if (sql.startsWith('INSERT INTO catalog_variant_steps')) throw new Error('synthetic interruption');
        return session.query(sql,params);
      } })) };
      await assert.rejects(new ContentRepository(faulty).importDraft(businessFixture('local-business-broken')),{code:'CONTENT_DATABASE_UNAVAILABLE'});
      assert.equal((await db!.query("SELECT 1 FROM public_releases WHERE id='local-business-broken'")).rows.length,0);
      assert.equal((await db!.query("SELECT 1 FROM content_sources WHERE id LIKE 'local-business-broken:%'")).rows.length,0);
      await repo.importDraft(businessFixture('local-business-draft'));
      await db!.query("UPDATE content_sources SET state='withdrawn' WHERE id='local-business-draft:nutrition'");
      await assert.rejects(repo.publish('local-business-draft'),{code:'CONTENT_SOURCE_UNAVAILABLE'});
      assert.equal((await db!.query<{state:string}>("SELECT state FROM catalog_releases WHERE id='local-business-draft'")).rows[0].state,'draft');
      await repo.importDraft(businessFixture('local-business-publish-broken'));
      const failedPublish:Database={...db!,withSession:work=>db!.withSession!(session=>work({...session,query:async(sql,params)=>{
        if(sql.startsWith('UPDATE catalog_recipes'))throw new Error('synthetic publish interruption');
        return session.query(sql,params);
      }}))};
      await assert.rejects(new ContentRepository(failedPublish).publish('local-business-publish-broken'),{code:'CONTENT_DATABASE_UNAVAILABLE'});
      assert.equal((await db!.query("SELECT 1 FROM catalog_foods WHERE release_id='local-business-publish-broken' AND state='published'")).rows.length,0);
      assert.equal((await db!.query<{state:string}>("SELECT state FROM catalog_releases WHERE id='local-business-publish-broken'")).rows[0].state,'draft');
      completed.push('transaction-rollback');
    });
    await t.test('真实数据库API串联新食材别名、变体、营养、约束和候选不足',async () => {
      const origin='http://127.0.0.1:4193';
      const app = await createApp({database:runtime,environment:'local',contentSource:'database',contentRelease:'local-business-a',origin}); apps.push(app);
      const catalog = await app.inject('/api/v1/catalog/recipes'); assert.equal(catalog.statusCode,200);
      const session = await app.inject('/api/v1/auth/session');
      const headers={cookie:String(session.headers['set-cookie']).split(';')[0],origin,'x-csrf-token':session.json().csrfToken};
      const extracted = await app.inject({method:'POST',url:'/api/v1/recognitions/text',headers,payload:{text:'构造角瓜200g',contentVersion:'local-business-a'}});
      assert.equal(extracted.json().ingredients[0].foodId,'local-zucchini');
      const meal=defaultMeal(); meal.ingredients=extracted.json().ingredients.map((i: any) => ({...i,status:'confirmed',basis:'edible'}));
      const calculate = async (body=request(meal)) => app.inject({method:'POST',url:'/api/v1/recommendations',headers,payload:body});
      const result = (await calculate()).json(); assert.equal(result.dishes[0].recipe.id,'local-zucchini');
      assert.deepEqual(result.dishes[0].nutrition,{kcal:20,protein:2,sodium:null});
      meal.servings=12; const twelve=(await calculate()).json(); assert.equal(twelve.dishes[0].variant.lines[0].amount,100);
      meal.overrides={'local-zucchini':'local-zucchini-spicy'};
      const changed=(await calculate()).json(); assert.equal(changed.dishes[0].variant.lines[0].amount,150); assert.equal(changed.dishes[0].nutrition.kcal,30);
      meal.overrides={};meal.allowBuy=true;meal.mode='candidates';
      const insufficient=(await calculate()).json(); assert.equal(insufficient.dishes.length,1); assert.equal(insufficient.targetMet,false);
      meal.restrictions=[{id:'avoid',kind:'avoid',name:'构造西葫芦',targets:['local-zucchini'],status:'confirmed',scope:'self',original:'构造西葫芦'}];
      const excluded=(await calculate()).json();assert.equal(excluded.status,'no_results');assert.equal(excluded.search,'complete');
      const mismatch=await calculate({...request(meal),contentVersion:'old'});assert.equal(mismatch.statusCode,409);
      completed.push('api-recommendation-constraints-nutrition');
    });
    await t.test('显式A→B→A回退可用；撤回版本即使旧状态被恢复也不复活',async () => {
      const b=businessFixture('local-business-b');b.recipes[0].name='构造第二版番茄炒蛋';
      await repo.importDraft(b);await repo.publish(b.contentVersion);
      assert.equal((await repo.load('local-business-b')).recipes.find(r => r.id==='tomato-egg')?.name,'构造第二版番茄炒蛋');
      assert.equal((await repo.load('local-business-a')).recipes.find(r => r.id==='tomato-egg')?.name,'番茄炒蛋');
      await repo.withdraw('local-business-b');await assert.rejects(repo.publish('local-business-b'),{code:'CONTENT_WITHDRAWN'});
      await db!.query("UPDATE catalog_releases SET state='published' WHERE id='local-business-b'");
      await assert.rejects(repo.load('local-business-b'),{code:'CONTENT_WITHDRAWN'});
      assert.equal((await repo.load('local-business-a')).contentVersion,'local-business-a');
      await repo.importDraft(businessFixture('local-business-source'));await repo.publish('local-business-source');
      await db!.query("UPDATE content_sources SET state='withdrawn' WHERE id='local-business-source:nutrition'");
      await assert.rejects(repo.load('local-business-source'),{code:'CONTENT_SOURCE_UNAVAILABLE'});
      completed.push('explicit-version-rollback-revocation');
    });
    await t.test('三道来源原方在真实PG草稿隔离、发布、失败回滚和撤回均有效',async()=>{
      const input=await reviewedContent('local-business-community-check');
      await repo.importDraft(input);await assert.rejects(repo.load(input.contentVersion),{code:'CONTENT_NOT_READY'});
      await repo.publish(input.contentVersion);
      const loaded=await new ContentRepository(runtime!).load(input.contentVersion);
      assert.equal(loaded.recipes.length,3);assert.equal(loaded.contentState,'database-reviewed');
      assert.deepEqual(loaded.sourceEvidence,input.sourceEvidence);assert(loaded.foods.every(f=>Object.keys(f.nutrition).length===0));
      const faulty:Database={...db!,withSession:work=>db!.withSession!(session=>work({...session,query:async(sql,params)=>{
        if(sql.startsWith('INSERT INTO catalog_variant_steps'))throw new Error('source import interruption');
        return session.query(sql,params);
      }}))};
      const broken=await reviewedContent('local-business-community-interrupted');
      await assert.rejects(new ContentRepository(faulty).importDraft(broken),{code:'CONTENT_DATABASE_UNAVAILABLE'});
      assert.equal((await db!.query('SELECT 1 FROM catalog_releases WHERE id=$1',[broken.contentVersion])).rows.length,0);
      await repo.withdraw(input.contentVersion);await assert.rejects(repo.load(input.contentVersion),{code:'CONTENT_WITHDRAWN'});
      assert.equal((await repo.load('local-business-a')).recipes.length,18);
      completed.push('real-community-draft-publish-rollback-withdraw');
    });
    await t.test('流式计算后数据库失败只发错误终态；真实连接池失效返回503并脱敏',async () => {
      let sessions=0;
      const interrupted:Database={...runtime!,withSession:work => ++sessions > 1 ? Promise.reject(new Error('sensitive-db-driver-message')) : runtime!.withSession!(work)};
      const app=await createApp({database:interrupted,environment:'local',contentSource:'database',contentRelease:'local-business-a',origin:'http://localhost'});apps.push(app);
      const s=await app.inject('/api/v1/auth/session');
      const meal=defaultMeal();meal.ingredients=extractText('构造角瓜200g',contentContext(await repo.load('local-business-a'))).ingredients.map(i => ({...i,status:'confirmed',basis:'edible'}));
      const stream=await app.inject({method:'POST',url:'/api/v1/recommendations',headers:{cookie:String(s.headers['set-cookie']).split(';')[0],origin:'http://localhost','x-csrf-token':s.json().csrfToken,accept:'application/x-ndjson'},payload:request(meal)});
      const events=stream.body.trim().split('\n').map(line=>JSON.parse(line));
      assert.deepEqual(events.map(e=>e.type),['progress','error']);assert.equal(events[1].code,'CONTENT_DATABASE_UNAVAILABLE');assert.ok(!stream.body.includes('sensitive-db'));
      await repo.importDraft(businessFixture('local-business-revoked-during'));await repo.publish('local-business-revoked-during');
      let calls=0;
      const revokedDuring:Database={...runtime!,withSession:async work=>{if(++calls===2)await repo.withdraw('local-business-revoked-during');return runtime!.withSession!(work);}};
      const revokedApp=await createApp({database:revokedDuring,environment:'local',contentSource:'database',contentRelease:'local-business-revoked-during',origin:'http://localhost'});apps.push(revokedApp);
      const identity=await revokedApp.inject('/api/v1/auth/session');
      const revoked=await revokedApp.inject({method:'POST',url:'/api/v1/recommendations',headers:{cookie:String(identity.headers['set-cookie']).split(';')[0],origin:'http://localhost','x-csrf-token':identity.json().csrfToken,accept:'application/x-ndjson'},payload:request(meal)});
      const revokedEvents=revoked.body.trim().split('\n').map(line=>JSON.parse(line));assert.deepEqual(revokedEvents.map(e=>e.type),['progress','error']);assert.equal(revokedEvents[1].code,'CONTENT_WITHDRAWN');
      const failedPool=await connectDatabase(runtimeUrl.toString());await failedPool.close();
      const failed=await createApp({database:failedPool,environment:'local',contentSource:'database',contentRelease:'local-business-a'});apps.push(failed);
      const response=await failed.inject('/api/v1/catalog/recipes');assert.equal(response.statusCode,503);assert.equal(response.json().error.code,'CONTENT_DATABASE_UNAVAILABLE');
      completed.push('stream-and-real-pool-failure');
    });
    const evidence = process.env.ACCEPTANCE_DIR;
    if (evidence) {
      await mkdir(evidence,{recursive:true});
      await writeFile(join(evidence,'postgres-business.json'),JSON.stringify({checkedAt:new Date().toISOString(),realPostgres:true,
        databaseScope:'random-isolated-local-business-test',completed,constructedRecipes:18,constructedVariants:36,communityRecipes:3,production:false,professionalReview:false,models:false,healthRules:false},null,2));
    }
  } finally {
    for(const app of apps)await app.close();await runtime?.close();await db?.close();
    if(created && /^shiwei_business_test_[a-f0-9]{32}$/.test(database))run(['exec','shiwei-local-db-1','dropdb','-U','postgres',database]);
  }
});
