import { readFile,writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';

const execute=promisify(execFile);
const envId='shiwei-d2gmiun66b7dc6a4f';
const cli='.local-data/tooling/cloudbase-cli/node_modules/@deployment/cloudbase/cli/bin/tcb';
const directory='.local-data/cloudbase-http/account-ingredients-20261024';
async function command(args:string[]){const {stdout}=await execute(process.execPath,[cli,...args,'-e',envId,'--region','ap-shanghai','--json'],{maxBuffer:1024*1024});const start=stdout.indexOf('{');if(start<0)throw Error('CLI_RESPONSE');return JSON.parse(stdout.slice(start));}
async function main(){
  let fixtures:{name:string;password:string;uid:string}[];
  try{fixtures=JSON.parse(await readFile(`${directory}/fixtures.private.json`,'utf8'));}
  catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    fixtures=[];
    for(const name of ['shiwei-test-20261024-a','shiwei-test-20261024-b']){
      const password=`Sw!9${randomBytes(18).toString('base64url')}`;
      const result=await command(['user','create',name,'--password',password,'--type','externalUser','--description','拾味自动验收构造账号，不保存真实资料']);
      const uid=result.data?.Data?.Uid??result.data?.Uid;
      if(typeof uid!=='string')throw Error('USER_CREATE_RESPONSE');
      fixtures.push({name,password,uid});
      await writeFile(`${directory}/fixtures.private.json`,JSON.stringify(fixtures),{mode:0o600});
    }
  }
  const rows=[];
  for(const fixture of fixtures){
    const response=await fetch(`https://${envId}.api.tcloudbasegateway.com/auth/v1/signin`,{method:'POST',headers:{'Content-Type':'application/json','x-device-id':`shiwei-test-${randomBytes(8).toString('hex')}`},body:JSON.stringify({username:fixture.name,password:fixture.password}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(!response.ok){rows.push({name:fixture.name,status:response.status,error:data.error,errorCode:data.error_code});continue;}
    const token=data.access_token;
    if(typeof token!=='string')throw Error('NO_ACCESS_TOKEN');
    const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
    const check=await fetch(`https://${envId}.api.tcloudbasegateway.com/auth/v1/token/introspect`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
    const introspection=await check.json();
    rows.push({name:fixture.name,status:response.status,role:claims.role,tokenLength:token.length,hasSub:typeof data.sub==='string',subjectMatches:data.sub===fixture.uid,introspected:check.ok&&introspection.sub===data.sub});
  }
  console.log(JSON.stringify({fixtures:fixtures.length,checks:rows,credentialsPrinted:false}));
}
main().catch(()=>{console.error('CLOUDBASE_ACCOUNT_PROBE_FAILED');process.exitCode=1;});
