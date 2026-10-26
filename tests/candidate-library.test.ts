import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createApp } from '../server/app';
import { connectDatabase, type Database } from '../server/db';

const candidateRow = {
  dish_key: '地三鲜', flavor: '咸鲜', source_uri: 'https://github.com/Anduin2017/HowToCook/blob/commit/dishes/地三鲜.md',
  raw_record: { name: '地三鲜', main: ['茄子'], steps: ['炒熟'] }, review_state: 'pending_review',
  image_url: '/assets/recipes/di-san-xian-finedining-v1.png', reference_image_url: 'https://raw.githubusercontent.com/Anduin2017/HowToCook/commit/dishes/地三鲜.jpg',
  image_review_state: 'pending_review', image_source_uri: 'https://github.com/Anduin2017/HowToCook/blob/commit/dishes/地三鲜.md',
};

test('candidate gallery reads unapproved recipes only in local mode and keeps them unpublished', async () => {
  const calls: string[] = [];
  const database: Database = {
    query: async <T>(sql: string) => {
      calls.push(sql);
      if (sql.includes('to_regclass')) return { rows: [{ present: true } as T] };
      return { rows: [candidateRow as T] };
    }, exec: async () => {}, close: async () => {},
  };
  const app = await createApp({ database, environment: 'local' });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/local/candidate-recipes' });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.state, 'candidate_only');
    assert.equal(body.published, false);
    assert.equal(body.recipes[0].image_url, candidateRow.image_url);
    assert.equal(body.recipes[0].reference_image_url, candidateRow.reference_image_url);
    assert.match(calls[1], /c\.review_state='pending_review'/);
    assert.match(response.headers['content-security-policy'] ?? '', /raw\.githubusercontent\.com/);
  } finally { await app.close(); }
});

test('candidate gallery route is absent outside local environment', async () => {
  const database: Database = {
    query: async () => { throw new Error('must not query candidates'); }, exec: async () => {}, close: async () => {},
  };
  const app = await createApp({ database, environment: 'staging' });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/local/candidate-recipes' });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, 'LOCAL_CANDIDATES_UNAVAILABLE');
  } finally { await app.close(); }
});

test('real local PostgreSQL candidate rows and generated image paths are served', { skip: process.env.CANDIDATE_PG_INTEGRATION !== '1' }, async () => {
  const ownerUrl = new URL((await readFile(resolve('.local-data/deployment/db-app-url'), 'utf8')).trim());
  assert.equal(ownerUrl.hostname, '127.0.0.1');
  assert.equal(ownerUrl.port, '5432');
  assert.equal(ownerUrl.username, 'shiwei_app');
  ownerUrl.pathname = '/shiwei_business_local';
  const database = await connectDatabase(ownerUrl.toString(), { max: 1, connectTimeoutMs: 3000, queryTimeoutMs: 10000 });
  const app = await createApp({ database, environment: 'local', staticRoot: resolve('build/web') });
  try {
    const privileges=await database.query<{can_read:boolean;can_write:boolean}>("SELECT has_table_privilege(current_user,'recipe_candidate_reviews','SELECT') AS can_read,has_table_privilege(current_user,'recipe_candidate_reviews','INSERT') AS can_write");
    assert.equal(privileges.rows[0].can_read,true);assert.equal(privileges.rows[0].can_write,false);
    const response = await app.inject({ method: 'GET', url: '/api/v1/local/candidate-recipes' });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.state, 'candidate_only');
    assert.equal(body.published, false);
    assert.equal(body.count, 147);
    assert.equal(new Set(body.recipes.map((row: { dish_key: string }) => row.dish_key)).size, 145);
    const supplement=body.recipes.filter((r:any)=>/^R41[1-8]$/.test(r.raw_record.id));
    assert.equal(supplement.length,8);assert(supplement.every((r:any)=>r.raw_record.review_state==='pending_review'));
    assert.equal(supplement.find((r:any)=>r.raw_record.id==='R411').raw_record.method_options.length,2);
    assert.equal(body.recipes.find((r:any)=>r.raw_record.id==='R391').flavor,'麻酱酸甜');
    assert(!body.recipes.find((r:any)=>r.raw_record.id==='R337').raw_record.aux.some((s:string)=>s.startsWith('马蹄')));
    assert.deepEqual(body.recipes.find((r:any)=>r.raw_record.id==='R288').raw_record.aux,['蒜 4 瓣（切末）']);
    assert.equal(body.recipes.find((r:any)=>r.raw_record.id==='R315').raw_record.method_options.length,2);
    assert(!body.recipes.find((r:any)=>r.raw_record.id==='R345').raw_record.steps.includes('--'));
    for(const id of ['R261','R272','R321','R389'])assert.equal(body.recipes.find((r:any)=>r.raw_record.id===id).raw_record.category,'meat');
    const generated = body.recipes.filter((row: { image_url: string | null }) => row.image_url);
    const manifest=JSON.parse(await readFile(resolve('docs/data/recipe-candidate-images.json'),'utf8'));
    const expected=new Map<string,string>();
    for(const item of manifest.generated){
      const row=body.recipes.find((r:any)=>r.raw_record.id===item.id);
      assert(row,`Mapped image ID must exist in database: ${item.id}`);
      expected.set(row.dish_key,item.image);
    }
    assert.deepEqual(new Map(generated.map((r:any)=>[r.dish_key,r.image_url])),expected);
    for(const url of new Set<string>(expected.values())){
      const image=await app.inject({method:'GET',url});
      assert.equal(image.statusCode,200,url);
      assert.match(image.headers['content-type']??'',/image\/png/);
      const webp=await app.inject({method:'GET',url:url.replace(/\.png$/,'.webp')});
      assert.equal(webp.statusCode,200,url);
      assert.match(webp.headers['content-type']??'',/image\/webp/);
    }
  } finally { await app.close(); await database.close(); }
});

test('candidate database failure is a recoverable 503 without driver details',async()=>{
  const database:Database={query:async()=>{throw Object.assign(new Error('private database details'),{code:'42501'});},exec:async()=>{},close:async()=>{}};
  const app=await createApp({database,environment:'local'});
  try{
    const r=await app.inject('/api/v1/local/candidate-recipes');assert.equal(r.statusCode,503);
    assert.equal(r.json().error.code,'LOCAL_CANDIDATE_DATABASE_UNAVAILABLE');assert(!r.body.includes('42501'));assert(!r.body.includes('private'));
  }finally{await app.close();}
});
