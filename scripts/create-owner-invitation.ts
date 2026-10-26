import { readFile,writeFile,open } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
const execute=promisify(execFile);
async function main(){
  const directory='.local-data/cloudbase-http/account-ingredients-20261024';
  const credentialsPath=`${directory}/owner-invitation.private.json`;
  try{await readFile(credentialsPath);console.log('Existing owner invitation preserved; no changes');return;}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const username='shiwei',password=`Sw!9${randomBytes(18).toString('base64url')}`;
  // Save before provisioning so an interrupted CLI response cannot lose the initial password.
  const file=await open(credentialsPath,'wx',0o600);
  const invitation={url:'https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com/?settings=1',username,initialPassword:password,status:'prepared',instructions:'首次登录后按页面要求修改初始密码，再用新密码登录。不要分享此文件。'};
  await file.writeFile(JSON.stringify(invitation,null,2));await file.close();
  const {stdout}=await execute(process.execPath,['.local-data/tooling/cloudbase-cli/node_modules/@cloudbase/cli/bin/tcb','user','create',username,'--password',password,'--type','externalUser','--description','拾味项目所有者受邀账号，首次登录修改密码','-e','shiwei-d2gmiun66b7dc6a4f','--region','ap-shanghai','--json'],{maxBuffer:1024*1024});
  const result=JSON.parse(stdout.slice(stdout.indexOf('{'))),uid=result.data?.Data?.Uid??result.data?.Uid;
  if(typeof uid!=='string')throw Error('INVITATION_NOT_CONFIRMED');
  await writeFile(credentialsPath,JSON.stringify({...invitation,status:'created',uid},null,2));
  console.log(JSON.stringify({created:true,username,initialPasswordPrinted:false,firstLoginPasswordChange:true}));
}
main().catch(()=>{console.error('INVITATION_FAILED_PRIVATE_FILE_PRESERVED');process.exitCode=1;});
