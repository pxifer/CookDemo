import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

export function assertLocalTestDatabase(value:string,structureOnly=false){
  try{
    const url=new URL(value);
    if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/^\/shiwei_[a-z0-9_]+$/.test(url.pathname)||url.searchParams.has('host')||url.searchParams.has('hostaddr'))throw Error();
    if(structureOnly&&url.pathname!=='/shiwei_test_structure')throw Error();
  }catch{throw Error('LOCAL_TEST_DATABASE_REQUIRED');}
}
export async function validateLocalTestConfig(kind:'structure'|'app'|'owner'|'business'){
  if(kind==='business'){
    const env=parseEnv(await readFile('.local-data/deployment/business-local.env','utf8'));
    if(env.APP_ENV&&env.APP_ENV!=='local')throw Error('LOCAL_TEST_ENVIRONMENT_REQUIRED');
    if(env.MODEL_ENABLED&&!['0','false'].includes(env.MODEL_ENABLED))throw Error('LOCAL_TEST_MODEL_MUST_BE_DISABLED');
    if(Object.keys(env).some(key=>/^(CLOUDBASE_|TCB_|SHIWEI_EVALUATION_|DEEPSEEK_|HEALTH_MODEL_)/.test(key)))throw Error('LOCAL_TEST_CLOUD_CONFIGURATION_REJECTED');
    if(Boolean(env.DATABASE_URL)===Boolean(env.DATABASE_URL_FILE))throw Error('LOCAL_TEST_DATABASE_REQUIRED');
    const url=env.DATABASE_URL??(await readFile(resolve(env.DATABASE_URL_FILE!),'utf8')).trim();
    assertLocalTestDatabase(url);
  }else{
    const file={structure:'db-test-url',app:'db-app-url',owner:'db-owner-url'}[kind];
    assertLocalTestDatabase((await readFile(`.local-data/deployment/${file}`,'utf8')).trim(),kind==='structure');
  }
}
