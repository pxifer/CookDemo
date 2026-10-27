import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium, expect } from '@playwright/test';
import { CloudBaseAccounts } from '../server/cloudbase-accounts';
const execute=promisify(execFile),envId='shiwei-d2gmiun66b7dc6a4f';
let stage='init';
const root='acceptance/health-chat-2026-10-27',origin=`https://${envId}-1512010497.ap-shanghai.app.tcloudbase.com`;
async function cli(args:string[]){
  const {stdout}=await execute(process.execPath,['.local-data/tooling/cloudbase-cli/node_modules/@cloudbase/cli/bin/tcb',...args,'-e',envId,'--region','ap-shanghai','--json'],{maxBuffer:2*1024*1024,windowsHide:true});
  const result=JSON.parse(stdout.slice(stdout.indexOf('{')));if(result.error)throw Error('CLOUD_COMMAND_FAILED');return result.data;
}
async function main(){
  await mkdir(root,{recursive:true});
  const name=`sw-chat-${randomBytes(4).toString('hex')}`,password=`Chat!9${randomBytes(9).toString('hex')}`,next=`Chat!8${randomBytes(9).toString('hex')}`;
  const dummyKey='sk-live-ui-test-only-never-sent-12345';
  let uid:string|undefined;
  const report={verifiedAt:new Date().toISOString(),revision:process.argv[2]??'health-chat-v35',syntheticAccount:true,desktop:false,mobile:false,loginReturnsToHealth:false,keyMemoryOnly:false,sharedClaim:false,duplicateRejected:false,providerCalls:0,realApiKeyUsed:false,cleanup:false};
  try{
    stage='create-synthetic';const created=await cli(['user','create',name,'--password',password,'--type','externalUser','--description','一次性健康聊天入口验证，无真实Key或模型调用，结束删除']);
    uid=created.Data?.Uid??created.Uid;if(typeof uid!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))throw Error('SYNTHETIC_ID');
    const accounts=new CloudBaseAccounts({envId,cookieKey:randomBytes(32),profileKey:randomBytes(32),keyVersion:'chat-live-probe-v1'});
    stage='initialize-synthetic';const initial=await accounts.login(name,password);if(initial.userId!==uid)throw Error('SYNTHETIC_ID_MISMATCH');await accounts.changePassword(initial,password,next);await accounts.logout(initial);
    const browser=await chromium.launch({channel:'msedge',headless:true});
    try{for(const device of ['desktop','mobile'] as const){
      const context=await browser.newContext({baseURL:origin,viewport:device==='mobile'?{width:390,height:844}:{width:1440,height:1000},isMobile:device==='mobile',hasTouch:device==='mobile',locale:'zh-CN'});
      try{
        const page=await context.newPage();let chatPosts=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/v1/health/chat'))chatPosts++;});
        stage=`${device}-visit`;await page.goto('/');const confirm=page.getByRole('button',{name:'确定访问',exact:true});await expect(confirm.or(page.locator('.site-header'))).toBeVisible({timeout:30000});if(await confirm.isVisible())await confirm.click();
        stage=`${device}-health-entry`;await page.getByRole('button',{name:/健康模式/}).click();await expect(page.getByRole('dialog')).not.toContainText('健康推荐暂不可用');
        await page.getByRole('button',{name:'登录并设置健康模式',exact:true}).click();
        stage=`${device}-login`;await page.getByLabel('用户名',{exact:true}).fill(name);await page.getByLabel('密码',{exact:true}).fill(next);await page.getByRole('button',{name:'登录',exact:true}).click();
        stage=`${device}-login-return`;const key=page.getByLabel('DeepSeek API Key',{exact:true});await expect(key).toBeVisible({timeout:40000});await expect(key).toHaveAttribute('type','password');
        stage=`${device}-enable`;await key.fill(dummyKey);await page.getByRole('button',{name:'开启健康模式',exact:true}).click();
        const chat=page.getByRole('region',{name:'健康AI对话',exact:true});await expect(chat).toBeVisible();await expect(chat.getByRole('button',{name:'发送消息',exact:true})).toBeDisabled();
        if(await page.evaluate(secret=>[...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>value.includes(secret)),dummyKey))throw Error('KEY_STORAGE_LEAK');
        if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('HORIZONTAL_OVERFLOW');
        await chat.screenshot({path:`${root}/live-${device}-chat.png`});
        stage=`${device}-reload`;await page.reload();await expect(chat).toBeVisible({timeout:30000});await chat.getByRole('button',{name:'填写 API Key',exact:true}).click();await expect(key).toHaveValue('');
        stage=`${device}-logout`;await page.keyboard.press('Escape');await page.getByRole('button',{name:'个人设置',exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(chat).toHaveCount(0);
        if(chatPosts!==0)throw Error('UNEXPECTED_PROVIDER_REQUEST');report[device]=true;
      }finally{await context.close();}
    }}finally{await browser.close();}
    stage='shared-claim';const identity=await accounts.login(name,next),operation=randomUUID();
    report.sharedClaim=(await accounts.claimAiChat(identity,operation,'a'.repeat(64))).claimed;
    const repeat=await accounts.claimAiChat(identity,operation,'a'.repeat(64));report.duplicateRejected=!repeat.claimed&&repeat.reason==='duplicate';await accounts.logout(identity);
    if(!report.sharedClaim||!report.duplicateRejected)throw Error('SHARED_CLAIM_FAILED');
    report.loginReturnsToHealth=true;report.keyMemoryOnly=true;
  }finally{
    if(uid){
      const found=await cli(['user','list','--uids',uid]);if(!Array.isArray(found)||found.length!==1||found[0].Name!==name||found[0].Uid!==uid)throw Error('SYNTHETIC_CLEANUP_OWNERSHIP');
      await cli(['db','execute','--role','cloudbase_postgres','--sql',`DELETE FROM public.shiwei_ai_chat_operations WHERE owner_id='${uid}'; DELETE FROM public.shiwei_account_sessions WHERE owner_id='${uid}'; DELETE FROM public.shiwei_account_state WHERE owner_id='${uid}';`]);
      const removed=await cli(['user','delete',uid,'--yes']);if((removed.Data?.SuccessCount??removed.SuccessCount)!==1)throw Error('SYNTHETIC_CLEANUP_FAILED');report.cleanup=true;
    }
    await writeFile(`${root}/live-verification.json`,JSON.stringify({...report,lastStage:stage},null,2));
  }
  console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(JSON.stringify({error:'HEALTH_CHAT_LIVE_VERIFY_FAILED',stage,code:typeof error?.code==='string'?error.code:error?.name??'Error'}));process.exitCode=1;});
