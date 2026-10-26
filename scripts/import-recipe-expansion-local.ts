import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connectDatabase, type Database } from '../server/db';

type Row = { rank:number; tier:number; dish_key:string; ingredientEntryCount:number; method:string; source:string;
  sourceUri:string; recipe:{id:string;dish_key:string;flavor:string;category:string;url:string;author:string;source:string;[key:string]:unknown} };
const batchPrefix='recipe-expansion-20261026';
const data=(await readFile('docs/data/recipe-expansion-simple-v1.jsonl','utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line) as Row);
const editorialDrafts=(await readFile('docs/data/recipe-original-drafts-2026-10-26.jsonl','utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line) as Row);
if(new Set(data.map(row=>row.dish_key)).size!==200||new Set(data.map(row=>row.recipe.id)).size!==data.length||data.some(row=>row.rank<1||row.rank>200))throw Error('EXPANSION_PACK_INVALID');
const stable=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const hash=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex');
const openLocalDatabase=async()=>{
  const base=new URL((await readFile(resolve('.local-data/deployment/db-owner-url'),'utf8')).trim());
  if(base.hostname!=='127.0.0.1'||base.port!=='5432'||base.username!=='shiwei_owner')throw Error('EXPANSION_DB_TARGET_REJECTED');
  base.pathname='/shiwei_business_local';
  const db=await connectDatabase(base.toString(),{max:1,connectTimeoutMs:3000,queryTimeoutMs:10000});
  const target=await db.query<{database:string;role:string}>('SELECT current_database() AS database,current_user AS role');
  if(target.rows[0]?.database!=='shiwei_business_local'||target.rows[0]?.role!=='shiwei_owner'){await db.close();throw Error('EXPANSION_DB_TARGET_REJECTED');}
  return db;
};
async function transaction<T>(db:Database,work:(session:Database)=>Promise<T>):Promise<T>{
  if(!db.withSession)throw Error('EXPANSION_DB_SESSION_REQUIRED');
  return db.withSession(async session=>{await session.exec('BEGIN');try{const result=await work(session);await session.exec('COMMIT');return result;}catch(error){try{await session.exec('ROLLBACK');}catch{}throw error;}});
}
const allRows=[...data,...editorialDrafts];
const sources=['previous','cctv','chef-indexed','bilibili-description','shiwei-original-draft'];
const batches=sources.map(source=>({id:`${batchPrefix}-${source}-v1`,source,rows:allRows.filter(row=>row.source===source)})).filter(batch=>batch.rows.length);
const action=process.argv[2]??'plan';
if(!['plan','import','inspect'].includes(action))throw Error('EXPANSION_ACTION_INVALID');
if(action==='plan'){
  console.log(JSON.stringify({databaseWrites:0,state:'candidate_only',uniqueDishes:new Set(data.map(row=>row.dish_key)).size,recipeVersions:data.length,
    editorialDrafts:editorialDrafts.map(row=>row.dish_key),batches:batches.map(batch=>({id:batch.id,source:batch.source,rows:batch.rows.length})),publicReleaseWrites:0},null,2));
}else{
  const db=await openLocalDatabase();
  try{
    const table=await db.query<{present:boolean}>(`SELECT to_regclass('public.recipe_candidate_batches') IS NOT NULL AND to_regclass('public.recipe_candidates') IS NOT NULL AND to_regclass('public.recipe_candidate_images') IS NOT NULL AND to_regclass('public.recipe_candidate_reviews') IS NOT NULL AS present`);
    if(!table.rows[0]?.present)throw Error('EXPANSION_CANDIDATE_TABLES_NOT_READY');
    const results=[];
    for(const batch of batches){
      const sourceDigest=hash(batch.rows.map(row=>row.recipe));
      const sourceCommit=`expansion-${sourceDigest.slice(0,32)}`;
      const licenseEvidence='Internal candidate import only. Rights are not cleared for public release; source URI and author are retained per record. No item is approved by this batch.';
      const result=await transaction(db,async session=>{
        if(action==='import'){
          await session.query(`INSERT INTO recipe_candidate_batches(id,source_repository,source_commit,license_name,license_evidence,expected_count)
            VALUES($1,'shiwei-internal-recipe-expansion',$2,'pending-rights-review',$3,$4) ON CONFLICT(id) DO NOTHING`,[batch.id,sourceCommit,licenseEvidence,batch.rows.length]);
          const metadata=await session.query<{source_commit:string;license_name:string;license_evidence:string;expected_count:number;state:string}>(
            'SELECT source_commit,license_name,license_evidence,expected_count,state FROM recipe_candidate_batches WHERE id=$1',[batch.id]);
          const meta=metadata.rows[0];
          if(!meta||meta.source_commit!==sourceCommit||meta.license_name!=='pending-rights-review'||meta.license_evidence!==licenseEvidence||Number(meta.expected_count)!==batch.rows.length||meta.state!=='candidate_only')throw Error('EXPANSION_BATCH_CONFLICT');
          for(const row of batch.rows){
            const card=row.recipe;
            await session.query(`INSERT INTO recipe_candidates(batch_id,source_record_id,dish_key,flavor,source_uri,raw_sha256,raw_record)
              VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(batch_id,source_record_id) DO NOTHING`,
              [batch.id,card.id,card.dish_key,card.flavor,row.sourceUri,hash(card),JSON.stringify({...card,expansion:{rank:row.rank,tier:row.tier,ingredientEntryCount:row.ingredientEntryCount,method:row.method,rights:'pending-review'}})]);
          }
          for(const row of batch.rows){
            await session.query(`INSERT INTO recipe_candidate_images(batch_id,dish_key,image_url,reference_image_url,source_uri,license_name,review_state)
              VALUES($1,$2,NULL,NULL,$3,'pending-rights-review','pending_review') ON CONFLICT(batch_id,dish_key) DO NOTHING`,
              [batch.id,row.dish_key,row.sourceUri]);
          }
        }
        const result=await session.query<{count:number;dishes:number;pending:number}>(`SELECT count(*)::int AS count,count(DISTINCT dish_key)::int AS dishes,
          count(*) FILTER(WHERE review_state='pending_review')::int AS pending
          FROM recipe_candidates WHERE batch_id=$1`,[batch.id]);
        const stats=result.rows[0];
        const storedHashes=await session.query<{source_record_id:string;raw_sha256:string}>(
          'SELECT source_record_id,raw_sha256 FROM recipe_candidates WHERE batch_id=$1',[batch.id]);
        const expectedHashes=new Map(batch.rows.map(row=>[row.recipe.id,hash(row.recipe)]));
        const hashMismatches=storedHashes.rows.length!==expectedHashes.size||storedHashes.rows.some(row=>expectedHashes.get(row.source_record_id)!==row.raw_sha256);
        if(action==='inspect'&&(!stats||Number(stats.count)!==batch.rows.length||Number(stats.dishes)<1||Number(stats.pending)!==batch.rows.length))throw Error('EXPANSION_BATCH_NOT_PRESENT');
        if(action==='import'&&(!stats||Number(stats.count)!==batch.rows.length||Number(stats.pending)!==batch.rows.length||hashMismatches))throw Error('EXPANSION_BATCH_INTEGRITY_FAILED');
        if(action==='inspect'&&hashMismatches)throw Error('EXPANSION_BATCH_INTEGRITY_FAILED');
        return {batch:batch.id,expectedRecipes:batch.rows.length,stats:stats??null,hashMismatches:Number(hashMismatches)};
      });
      results.push(result);
    }
    console.log(JSON.stringify({database:'shiwei_business_local',state:'candidate_only',published:false,results,
      uniqueDishes:new Set(allRows.map(row=>row.dish_key)).size,recipeVersions:allRows.length,images:0,rightsApproved:0},null,2));
  }finally{await db.close();}
}
