import { readFile,writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
async function main(){
  const file='.local-data/cloudbase-http/account-ingredients-20261024/initial-password-fixtures.private.json';
  try{await readFile(file);throw Error('FIXTURES_ALREADY_EXIST');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const records=[];
  for(const project of ['desktop','mobile']){
    const name=`shiwei-test-20261024-initial-${project}`,initialPassword=`Sw!9${randomBytes(18).toString('base64url')}`,password=`Sw!9${randomBytes(18).toString('base64url')}`;
    const {stdout}=await promisify(execFile)(process.execPath,['.local-data/tooling/cloudbase-cli/node_modules/@cloudbase/cli/bin/tcb','user','create',name,'--password',initialPassword,'--type','externalUser','--description','首次改密构造验收账号','-e','shiwei-d2gmiun66b7dc6a4f','--region','ap-shanghai','--json'],{maxBuffer:1024*1024});
    const result=JSON.parse(stdout.slice(stdout.indexOf('{'))),uid=result.data?.Data?.Uid??result.data?.Uid;
    if(typeof uid!=='string')throw Error('FIXTURE_CREATE_FAILED');
    records.push({name,uid,project,initialPassword,password});await writeFile(file,JSON.stringify(records),{mode:0o600});
  }
  console.log('Two isolated first-password UI fixtures prepared; credentials not printed');
}
main().catch(()=>{console.error('INITIAL_FIXTURES_FAILED');process.exitCode=1;});
