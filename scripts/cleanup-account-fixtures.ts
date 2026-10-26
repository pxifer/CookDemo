import { readFile,writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute=promisify(execFile);
const root='.local-data/cloudbase-http/account-ingredients-20261024';
const files=['fixtures.private.json','initial-password-fixtures.private.json'];
const allowed=new Set(['shiwei-test-20261024-a','shiwei-test-20261024-b','shiwei-test-20261024-initial-desktop','shiwei-test-20261024-initial-mobile']);
async function command(args:string[]){
  const {stdout}=await execute(process.execPath,['.local-data/tooling/cloudbase-cli/node_modules/@cloudbase/cli/bin/tcb',...args,'-e','shiwei-d2gmiun66b7dc6a4f','--region','ap-shanghai','--json'],{maxBuffer:1024*1024});
  const result=JSON.parse(stdout.slice(stdout.indexOf('{')));if(result.error)throw Error('FIXTURE_CLEANUP_CLOUD_ERROR');return result;
}
async function main(){
  const groups=await Promise.all(files.map(async name=>({name,records:JSON.parse(await readFile(`${root}/${name}`,'utf8')) as {name:string;uid:string;password:string;deletedAt?:string}[]})));
  const records=groups.flatMap(g=>g.records);
  if(records.length!==4||new Set(records.map(r=>r.uid)).size!==4||records.some(r=>!allowed.has(r.name)||!/^[a-zA-Z0-9_-]{8,100}$/.test(r.uid)))throw Error('FIXTURE_BOUNDARY_REJECTED');
  const owner=JSON.parse(await readFile(`${root}/owner-invitation.private.json`,'utf8'));
  if(records.some(r=>r.uid===owner.uid))throw Error('OWNER_BOUNDARY_REJECTED');
  if(!process.argv.includes('--apply')){console.log('Validated cleanup scope: four synthetic accounts only; project owner excluded');return;}
  for(const record of records.filter(r=>!r.deletedAt)){
    const response=await fetch('https://shiwei-d2gmiun66b7dc6a4f.api.tcloudbasegateway.com/auth/v1/signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:record.name,password:record.password}),signal:AbortSignal.timeout(15000)});
    const verified=await response.json();if(!response.ok||verified.sub!==record.uid)throw Error('FIXTURE_IDENTITY_REJECTED');
  }
  const ids=records.map(r=>`'${r.uid}'`).join(',');
  await command(['db','execute','--role','cloudbase_postgres','--sql',`BEGIN;DELETE FROM public.shiwei_account_sessions WHERE owner_id IN (${ids});DELETE FROM public.shiwei_account_state WHERE owner_id IN (${ids});COMMIT;`]);
  for(const record of records.filter(r=>!r.deletedAt)){
    const response=await command(['user','delete',record.uid,'--yes']);
    if((response.data?.Data?.SuccessCount??response.data?.SuccessCount)!==1)throw Error('FIXTURE_DELETION_NOT_CONFIRMED');
    record.deletedAt=new Date().toISOString();
    for(const group of groups)await writeFile(`${root}/${group.name}`,JSON.stringify(group.records),{mode:0o600});
  }
  const deletedAt=new Date().toISOString();
  for(const group of groups)await writeFile(`${root}/${group.name}`,JSON.stringify(group.records.map(r=>({...r,deletedAt}))),{mode:0o600});
  await writeFile('acceptance/account-ingredients-2026-10-24/fixture-cleanup.json',JSON.stringify({deletedAt,syntheticAccountsDeleted:4,syntheticStateDeleted:true,projectOwnerUntouched:true,administratorUntouched:true,credentialsPrinted:false},null,2),{flag:'wx'});
  console.log('Four synthetic accounts and their test state removed; owner and administrator untouched');
}
main().catch(()=>{console.error('FIXTURE_CLEANUP_FAILED_NO_CREDENTIALS_PRINTED');process.exitCode=1;});
