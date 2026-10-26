import { readFile,cp,copyFile,mkdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

async function main(){
  const directory=resolve('.local-data/cloudbase-http/account-ingredients-20261024-v2');
  const migration=join(directory,'20261024010000_account_ingredients.sql');
  const db=new PGlite();
  try{
    await db.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'') $$;GRANT USAGE ON SCHEMA auth TO authenticated;");
    await db.exec(await readFile('deploy/db/gallery-http-release.sql','utf8'));
    await db.query('INSERT INTO shiwei_gallery_releases(release_id,checksum,payload,published) VALUES($1,$2,$3,true)',['gallery-preview-20261023','a'.repeat(64),{}]);
    await db.exec(await readFile(migration,'utf8'));
    await db.exec('SET ROLE anon');
    const counts=await db.query(`SELECT (SELECT count(*) FROM shiwei_ingredient_inventory)::int AS foods,(SELECT count(*) FROM shiwei_recipe_inventory)::int AS variants,(SELECT count(*) FROM shiwei_recipe_ingredient_lines)::int AS lines,(SELECT count(*) FROM shiwei_source_recipe_records)::int AS sources,(SELECT count(*) FROM shiwei_source_ingredient_entries)::int AS source_entries`);
    if(JSON.stringify(counts.rows[0])!==JSON.stringify({foods:372,variants:146,lines:1762,sources:147,source_entries:1726}))throw Error('MIGRATION_COUNTS');
    let denied=false;try{await db.query('SELECT * FROM shiwei_account_state');}catch{denied=true;}if(!denied)throw Error('PRIVATE_TABLE_EXPOSED');
    await db.exec('RESET ROLE');await db.exec("SELECT set_config('request.jwt.claim.sub','fixture-a',false);SET ROLE authenticated;");
    await db.query('SELECT shiwei_session_start($1,now()+interval \'30 minutes\')',['a'.repeat(64)]);
    console.log(JSON.stringify({localMigrationPassed:true,counts:counts.rows[0],anonPrivateDenied:denied,sourceFactsOnly:true}));
  }finally{await db.close();}
  const target=join(directory,'migration');await mkdir(target,{recursive:false});
  await cp('.local-data/cloudbase-http/release-20261023/migration/cloudbase',join(target,'cloudbase'),{recursive:true});
  await copyFile(migration,join(target,'cloudbase/migrations/20261024010000_account_ingredients.sql'));
}
main().catch(()=>{console.error('ACCOUNT_RELEASE_LOCAL_VERIFY_FAILED');process.exitCode=1;});
