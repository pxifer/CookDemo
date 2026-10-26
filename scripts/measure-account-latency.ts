import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {CloudBaseAccounts} from '../server/cloudbase-accounts';
const execute=promisify(execFile),envId='shiwei-d2gmiun66b7dc6a4f';
async function cli(args:string[]){const {stdout}=await execute(process.execPath,['.local-data/tooling/cloudbase-cli/node_modules/@cloudbase/cli/bin/tcb',...args,'-e',envId,'--region','ap-shanghai','--json'],{maxBuffer:2*1024*1024});const result=JSON.parse(stdout.slice(stdout.indexOf('{')));if(result.error)throw Error('CLOUD_COMMAND_FAILED');return result.data;}
const origin='https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com';
async function main(){
  const phase=process.argv[2];if(!['before','after'].includes(phase))throw Error('PHASE_REQUIRED');
  const fixture={name:`shiwei-latency-${phase}-${randomBytes(4).toString('hex')}`,password:`Ab1!${randomBytes(9).toString('hex')}`};
  let uid:string|undefined;
  let cookie='',csrf='';const times:Record<string,number>={};
  const call=async(label:string,path:string,body?:unknown)=>{
    const start=performance.now(),response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'x-csrf-token':csrf,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
    for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],name=pair.split('=')[0];cookie=[...cookie.split('; ').filter(p=>p&&!p.startsWith(name+'=')),pair].join('; ');}
    if(!response.ok)throw Error(`SYNTHETIC_${label}_${response.status}`);const data=await response.json();times[label]=Math.round(performance.now()-start);if(data.csrfToken)csrf=data.csrfToken;return data;
  };
  let signedIn=false;
  try{
    const created=await cli(['user','create',fixture.name,'--password',fixture.password,'--type','externalUser','--description','一次性登录速度测试，结束删除']);
    uid=created.Data?.Uid??created.Uid;if(typeof uid!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))throw Error('SYNTHETIC_ID');
    const service=new CloudBaseAccounts({envId,cookieKey:randomBytes(32),profileKey:randomBytes(32),keyVersion:'latency-probe-v1'});
    const setupIdentity=await service.login(fixture.name,fixture.password);if(setupIdentity.userId!==uid)throw Error('SYNTHETIC_ID_MISMATCH');
    const next=`Ab1!${randomBytes(9).toString('hex')}`;await service.changePassword(setupIdentity,fixture.password,next);fixture.password=next;await service.logout(setupIdentity);
    await call('guestSessionMs','/api/v1/auth/session');
    await call('loginPostMs','/api/v1/auth/login',{username:fixture.name,password:fixture.password});signedIn=true;
    const identity=await call('confirmedSessionMs',`/api/v1/auth/session${phase==='after'?'?state=1':''}`);
    if(identity.identity!=='account')throw Error('SESSION_NOT_CONFIRMED');
    if(phase==='before'){await call('reloadCatalogMs','/api/v1/catalog/recipes');await call('reloadSessionMs','/api/v1/auth/session');await call('loadSettingsMs','/api/v1/account/state');await call('duplicateAppSessionMs','/api/v1/auth/session');}
    else if(!identity.accountSnapshot)throw Error('COMBINED_SETTINGS_MISSING');
    times.totalLoginPathMs=Object.entries(times).filter(([key])=>key!=='guestSessionMs').reduce((sum,[,v])=>sum+v,0);
    let personalSettingsVerified=false;
    if(phase==='after'){
      const settings={flavor:'微辣',restrictions:[{id:'synthetic-latency-avoid',kind:'avoid',name:'牛肉',targets:['beef'],status:'confirmed',scope:'self',original:'构造验收'}],checkSeasonings:true,seasonings:['salt']};
      await call('saveSettingsMs','/api/v1/account/state',{expectedVersion:identity.accountSnapshot.version,value:{favorites:[],defaults:settings}});
      const firstCookie=cookie,firstCsrf=csrf;cookie='';csrf='';
      try{
        await call('otherDeviceGuestMs','/api/v1/auth/session');await call('otherDeviceLoginMs','/api/v1/auth/login',{username:fixture.name,password:fixture.password});
        const restored=await call('otherDeviceSettingsMs','/api/v1/auth/session?state=1'),saved=restored.accountSnapshot?.value?.defaults;
        if(restored.userId!==uid||saved?.flavor!=='微辣'||saved?.checkSeasonings!==true||saved?.seasonings?.join(',')!=='salt'||saved?.restrictions?.[0]?.name!=='牛肉')throw Error('SYNTHETIC_SETTINGS_NOT_RESTORED');personalSettingsVerified=true;
      }finally{try{await call('otherDeviceLogoutMs','/api/v1/auth/logout',{});}finally{cookie=firstCookie;csrf=firstCsrf;}}
    }
    await mkdir('acceptance/personal-settings-2026-10-24',{recursive:true});
    await writeFile(`acceptance/personal-settings-2026-10-24/latency-${phase}.json`,JSON.stringify({verifiedAt:new Date().toISOString(),phase,network:'local-client-to-Shanghai',sampleCount:1,times,syntheticAccount:true,personalSettingsVerified,personalContentsPrinted:false,includesColdStartUncontrolled:true},null,2),{flag:'wx'});
    console.log(JSON.stringify({phase,times,secretsPrinted:false}));
  }finally{
    try{if(signedIn)await call('logoutMs','/api/v1/auth/logout',{});}
    finally{if(uid){const found=await cli(['user','list','--uids',uid]);if(!Array.isArray(found)||found.length!==1||found[0].Name!==fixture.name||found[0].Uid!==uid)throw Error('SYNTHETIC_CLEANUP_OWNERSHIP');await cli(['db','execute','--role','cloudbase_postgres','--sql',`DELETE FROM public.shiwei_account_sessions WHERE owner_id='${uid}'; DELETE FROM public.shiwei_account_state WHERE owner_id='${uid}';`]);const deleted=await cli(['user','delete',uid,'--yes']);if((deleted.Data?.SuccessCount??deleted.SuccessCount)!==1)throw Error('SYNTHETIC_CLEANUP_UNCONFIRMED');console.log(JSON.stringify({phase,syntheticCleanup:true}));}}
  }
}
main().catch(error=>{console.error('ACCOUNT_LATENCY_CHECK_FAILED',/^(SYNTHETIC_|SESSION_|COMBINED_|PHASE_|EEXIST)/.test(error.message)?error.message:error.cause?.code??error.name);process.exitCode=1;});
