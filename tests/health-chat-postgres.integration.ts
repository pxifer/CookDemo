import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';

test('真实PG多连接：同账号重复操作只认领一次，不同操作并发也不突破每分钟6次', {skip:process.env.RUN_HEALTH_CHAT_POSTGRES!=='1',timeout:60000},async()=>{
  const docker=[process.env.DOCKER_EXE,`${process.env.LOCALAPPDATA}/Programs/DockerDesktop/resources/bin/docker.exe`,'C:/Program Files/Docker/Docker/resources/bin/docker.exe'].find(path=>path&&existsSync(path));assert(docker);
  const sync=(args:string[],input?:string)=>{const result=spawnSync(docker!,args,{input,encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(result.status,0,'Local isolated PostgreSQL command must succeed');return result.stdout.trim();};
  assert.equal(sync(['inspect','shiwei-local-db-1','--format','{{index .Config.Labels "com.docker.compose.project"}}']),'shiwei-local');
  const name=`shiwei_chat_test_${randomUUID().replaceAll('-','')}`;
  sync(['exec','shiwei-local-db-1','createdb','-U','postgres','-T','template0',name]);
  const psql=['exec','-i','shiwei-local-db-1','psql','-U','postgres','-d',name,'-v','ON_ERROR_STOP=1','-At'];
  const suffix=randomUUID().replaceAll('-','').slice(0,12),roles={anon:`chat_anon_${suffix}`,authenticated:`chat_auth_${suffix}`,service_role:`chat_service_${suffix}`};
  let rolesCreated=false;
  try{
    sync(['exec','shiwei-local-db-1','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`BEGIN; ${Object.values(roles).map(role=>`CREATE ROLE ${role} NOLOGIN;`).join(' ')} COMMIT;`]);rolesCreated=true;
    // auth.uid reads a per-connection synthetic claim. No business database/real account is used.
    const init=`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'') $$; GRANT USAGE ON SCHEMA auth TO ${roles.authenticated}; GRANT EXECUTE ON FUNCTION auth.uid() TO ${roles.authenticated};\n`;
    const schemas=(readFileSync('deploy/db/account-sync.sql','utf8')+'\n'+readFileSync('deploy/db/health-chat.sql','utf8')).replace(/\b(anon|authenticated|service_role)\b/g,role=>roles[role as keyof typeof roles]);
    const sql=init+schemas+`\nINSERT INTO shiwei_account_state(owner_id,password_initialized) VALUES('constructed-chat-user',true); INSERT INTO shiwei_account_sessions(owner_id,session_hash,expires_at) VALUES('constructed-chat-user',repeat('a',64),now()+interval '20 minutes');`;
    // Only random test roles and the random database are created; existing roles are untouched.
    sync(psql,sql);
    const execute=promisify(execFile),claim=async(operation:string)=>{
      const query=`SET ROLE ${roles.authenticated}; SELECT set_config('request.jwt.claim.sub','constructed-chat-user',false); SELECT public.shiwei_ai_chat_claim(repeat('a',64),'${operation}',repeat('b',64));`;
      const result=await execute(docker!,[...psql,'-c',query],{windowsHide:true,timeout:15000,maxBuffer:65536});
      return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)!);
    };
    const operation=randomUUID(),duplicates=await Promise.all(Array.from({length:8},()=>claim(operation)));
    assert.equal(duplicates.filter(value=>value.claimed).length,1);
    const distinct=await Promise.all(Array.from({length:10},()=>claim(randomUUID())));
    assert.equal(distinct.filter(value=>value.claimed).length,5);
    assert.equal(sync([...psql,'-c','SELECT count(*) FROM shiwei_ai_chat_operations;']),'6');
  }finally{sync(['exec','shiwei-local-db-1','dropdb','-U','postgres','--force',name]);if(rolesCreated)sync(['exec','shiwei-local-db-1','psql','-U','postgres','-d','postgres','-c',Object.values(roles).map(role=>`DROP ROLE ${role};`).join(' ')]);}
});
