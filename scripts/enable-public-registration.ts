import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute=promisify(execFile),envId='shiwei-d2gmiun66b7dc6a4f',root='.local-data/cloudbase-http/public-registration-20261024';
async function cli(args:string[]){
  const {stdout}=await execute(process.execPath,['.local-data/tooling/cloudbase-cli/node_modules/@deployment/cloudbase/cli/bin/tcb',...args,'--region','ap-shanghai','--json'],{maxBuffer:2*1024*1024});
  const result=JSON.parse(stdout.slice(stdout.indexOf('{')));if(result.error)throw Error(result.error.code);return result.data;
}
const api=(action:string,body:unknown)=>cli(['api','tcb',action,'--api-version','2018-06-08','--body',JSON.stringify(body)]);
async function main(){
  await mkdir(root,{recursive:false});
  const environments=await cli(['env','list']),env=environments.find((e:{EnvId:string})=>e.EnvId===envId);
  if(env?.PackageId!=='baas_trial'||env.EnableOverrun!==false||env.IsAutoRenew!==false)throw Error('FREE_BOUNDARY_NOT_MET');
  const original=await api('DescribeLoginConfig',{EnvId:envId}),providers=await api('GetProviders',{EnvId:envId});
  const email=providers.Data.find((p:{Id:string})=>p.Id==='email');if(!email)throw Error('EMAIL_PROVIDER_MISSING');
  // Retain the previous configuration privately for review/reversal. No admin
  // credentials or mail credentials are shipped in the application runtime.
  await writeFile(`${root}/previous-email-config.private.json`,JSON.stringify({login:original,email}),{flag:'wx',mode:0o600});
  await api('ModifyProvider',{EnvId:envId,Id:'email',On:'TRUE',EmailConfig:{On:'TRUE'}});
  const nextLogin=await api('DescribeLoginConfig',{EnvId:envId});
  if(!nextLogin.EmailLogin)await api('ModifyLoginConfig',{EnvId:envId,EmailLogin:true});
  const after=await api('DescribeLoginConfig',{EnvId:envId}),next=await api('GetProviders',{EnvId:envId});
  const active=next.Data.find((p:{Id:string})=>p.Id==='email');
  if(!after.EmailLogin||active?.On!=='TRUE'||active.EmailConfig?.On!=='TRUE'||after.UserNameLogin!==original.UserNameLogin||after.PhoneNumberLogin!==original.PhoneNumberLogin||after.AnonymousLogin!==original.AnonymousLogin)throw Error('CONFIGURATION_MISMATCH');
  const report={checkedAt:new Date().toISOString(),envId,region:'ap-shanghai',emailLogin:true,builtInMail:true,usernameLoginPreserved:true,phoneLoginUnchanged:true,anonymousLoginUnchanged:true,packageId:env.PackageId,enableOverrun:false,autoRenew:false,mailSent:false,adminCredentialsInRuntime:false};
  await mkdir('artifacts/acceptance/public-registration-2026-10-24',{recursive:true});
  await writeFile('artifacts/acceptance/public-registration-2026-10-24/provider-configuration.json',JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify(report));
}
main().catch(error=>{console.error('PUBLIC_REGISTRATION_CONFIGURATION_FAILED',/^[A-Z_]+$/.test(error.message)?error.message:error.name);process.exitCode=1;});
