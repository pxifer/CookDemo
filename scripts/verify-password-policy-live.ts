import { readFile,writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CloudBaseAccounts } from '../backend/src/cloudbase-accounts';
const execute=promisify(execFile),envId='shiwei-d2gmiun66b7dc6a4f',root='.local-data/cloudbase-http/password-feedback-20261024';
async function cli(args:string[]){
  const {stdout}=await execute(process.execPath,['.local-data/tooling/cloudbase-cli/node_modules/@deployment/cloudbase/cli/bin/tcb',...args,'-e',envId,'--region','ap-shanghai','--json'],{maxBuffer:2*1024*1024});
  const result=JSON.parse(stdout.slice(stdout.indexOf('{')));if(result.error)throw Error('CLOUD_COMMAND_FAILED');return result.data;
}
async function main(){
  const name=`shiwei-pw8-${randomBytes(5).toString('hex')}`;
  const password=()=>`Ab9!${randomBytes(2).toString('hex')}`;
  const initial=password(),next=password();if(initial.length!==8||next.length!==8||initial===next)throw Error('FIXTURE_PASSWORD');
  let uid:string|undefined,cleaned=false;
  const report={passwordLength:8,officialProviderCreate:false,officialProviderLogin:false,officialProviderPasswordChange:false,oldPasswordRejected:false,newPasswordLogin:false,cleanup:false,realEmailSignupVerified:false,secretsPrinted:false};
  try{
    const created=await cli(['user','create',name,'--password',initial,'--type','externalUser','--description','一次性8位密码规则验证，非真实用户']);
    uid=created.Data?.Uid??created.Uid;if(typeof uid!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))throw Error('FIXTURE_ID');report.officialProviderCreate=true;
    await writeFile(`${root}/fixture.private.json`,JSON.stringify({name,uid,initial,next}),{flag:'wx',mode:0o600});
    const accounts=new CloudBaseAccounts({envId,cookieKey:randomBytes(32),profileKey:randomBytes(32),keyVersion:'password-probe-v1'});
    const first=await accounts.login(name,initial);if(first.userId!==uid)throw Error('IDENTITY_MISMATCH');report.officialProviderLogin=true;
    await accounts.changePassword(first,initial,next);report.officialProviderPasswordChange=true;
    try{await accounts.login(name,initial);}catch(error){if((error as {code?:string}).code==='INVALID_LOGIN')report.oldPasswordRejected=true;else throw error;}
    const second=await accounts.login(name,next);if(second.userId!==uid||second.mustChangePassword)throw Error('NEW_PASSWORD_LOGIN');report.newPasswordLogin=true;
    await accounts.logout(second);
  }finally{
    if(uid){
      const found=await cli(['user','list','--uids',uid]);
      if(!Array.isArray(found)||found.length!==1||found[0].Name!==name||found[0].Uid!==uid)throw Error('CLEANUP_OWNERSHIP');
      await cli(['db','execute','--role','cloudbase_postgres','--sql',`DELETE FROM public.shiwei_account_sessions WHERE owner_id='${uid}'; DELETE FROM public.shiwei_account_state WHERE owner_id='${uid}';`]);
      const deleted=await cli(['user','delete',uid,'--yes']);
      if((deleted.Data?.SuccessCount??deleted.SuccessCount)!==1)throw Error('CLEANUP_NOT_CONFIRMED');cleaned=true;
    }
    report.cleanup=cleaned;
    await writeFile('artifacts/acceptance/password-feedback-2026-10-24/provider-password-policy.json',JSON.stringify(report,null,2),{flag:'wx'});
  }
  if(!report.oldPasswordRejected)throw Error('OLD_PASSWORD_STILL_VALID');console.log(JSON.stringify(report));
}
main().catch(()=>{console.error('PASSWORD_POLICY_LIVE_FAILED_DETAILS_KEPT_PRIVATE');process.exitCode=1;});
