import {writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chromium,expect} from '@playwright/test';
import {CloudBaseAccounts} from '../server/cloudbase-accounts';
const execute=promisify(execFile),envId='shiwei-d2gmiun66b7dc6a4f';
const root='acceptance/conventional-login-2026-10-24',origin=`https://${envId}-1512010497.ap-shanghai.app.tcloudbase.com`;
async function cli(args:string[]){const {stdout}=await execute(process.execPath,['.local-data/tooling/cloudbase-cli/node_modules/@cloudbase/cli/bin/tcb',...args,'-e',envId,'--region','ap-shanghai','--json'],{maxBuffer:2*1024*1024});const result=JSON.parse(stdout.slice(stdout.indexOf('{')));if(result.error)throw Error('CLOUD_COMMAND_FAILED');return result.data;}
async function main(){
  const name=`sw-login-${randomBytes(4).toString('hex')}`,password=`Ab1!${randomBytes(8).toString('hex')}`,next=`Ab1!${randomBytes(8).toString('hex')}`;
  let uid:string|undefined;const report={verifiedAt:new Date().toISOString(),desktop:false,mobile:false,oneLoginButton:false,silentDomFillSubmitted:false,oneRequestPerLogin:false,cleanup:false,syntheticAccount:true,secretsPrinted:false,realUserCredentialsUsed:false};
  await mkdir(root,{recursive:true});
  try{
    const created=await cli(['user','create',name,'--password',password,'--type','externalUser','--description','一次性常规登录UI验证，结束删除']);
    uid=created.Data?.Uid??created.Uid;if(typeof uid!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))throw Error('SYNTHETIC_ID');
    const accounts=new CloudBaseAccounts({envId,cookieKey:randomBytes(32),profileKey:randomBytes(32),keyVersion:'login-ui-probe-v1'});
    const identity=await accounts.login(name,password);if(identity.userId!==uid)throw Error('SYNTHETIC_ID_MISMATCH');await accounts.changePassword(identity,password,next);await accounts.logout(identity);
    const browser=await chromium.launch({channel:'msedge',headless:true});
    try{for(const device of ['desktop','mobile'] as const){
      const context=await browser.newContext({baseURL:origin,viewport:device==='mobile'?{width:390,height:844}:{width:1440,height:1000},isMobile:device==='mobile',hasTouch:device==='mobile',locale:'zh-CN'});
      try{
        const page=await context.newPage();await page.goto('/?settings=1');const confirm=page.getByRole('button',{name:'确定访问',exact:true});await expect(confirm.or(page.locator('.site-header'))).toBeVisible({timeout:25000});if(await confirm.isVisible())await confirm.click();
        await expect(page.getByRole('button',{name:'登录',exact:true})).toHaveCount(1);await expect(page.getByRole('heading',{name:'登录',exact:true})).toBeVisible();
        await page.evaluate(({name,password})=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;set.call(document.querySelector('input[name="username"]'),name);set.call(document.querySelector('input[name="password"]'),password);},{name,password:next});
        let posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/auth/login'))posts++;});
        await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.locator('.account-state')).toBeVisible({timeout:30000});await expect(page.getByRole('status').filter({hasText:'登录成功。'})).toBeVisible();
        if(posts!==1)throw Error('DUPLICATE_LOGIN');report[device]=true;
        await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
        await page.getByLabel('用户名',{exact:true}).fill('');await page.screenshot({path:`${root}/${device}-login.png`,fullPage:true});
      }finally{await context.close();}
    }}finally{await browser.close();}
    report.oneLoginButton=true;report.silentDomFillSubmitted=true;report.oneRequestPerLogin=true;
  }finally{
    if(uid){const found=await cli(['user','list','--uids',uid]);if(!Array.isArray(found)||found.length!==1||found[0].Name!==name||found[0].Uid!==uid)throw Error('SYNTHETIC_CLEANUP_OWNERSHIP');await cli(['db','execute','--role','cloudbase_postgres','--sql',`DELETE FROM public.shiwei_account_sessions WHERE owner_id='${uid}'; DELETE FROM public.shiwei_account_state WHERE owner_id='${uid}';`]);const deleted=await cli(['user','delete',uid,'--yes']);if((deleted.Data?.SuccessCount??deleted.SuccessCount)!==1)throw Error('SYNTHETIC_CLEANUP_UNCONFIRMED');report.cleanup=true;}
    await writeFile(`${root}/cloud-login-ui.json`,JSON.stringify(report,null,2),{flag:'wx'});
  }
  console.log(JSON.stringify(report));
}
main().catch(()=>{console.error('CONVENTIONAL_LOGIN_LIVE_FAILED_NO_PRIVATE_DETAILS');process.exitCode=1;});
