import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHmac,randomBytes } from 'node:crypto';
import { CloudBaseAccounts } from '../backend/src/cloudbase-accounts';
import { defaultMeal } from '../shared/types';

async function main(){
  const file='.local-data/cloudbase-http/account-ingredients-20261024/fixtures.private.json';
  const fixtures=JSON.parse(await readFile(file,'utf8')) as {name:string;password:string;uid:string;pendingPassword?:string}[];
  const config=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261024-account-v1/cloudbaserc.json','utf8')).functions[0].envVariables;
  const opts={envId:'shiwei-d2gmiun66b7dc6a4f',cookieKey:createHmac('sha256',Buffer.from(config.SESSION_SECRET_B64,'base64')).update('account-cookie-v1').digest(),profileKey:Buffer.from(config.PROFILE_ENCRYPTION_KEY_B64,'base64'),keyVersion:config.PROFILE_KEY_VERSION};
  const service=new CloudBaseAccounts(opts),identities=[];
  for(const fixture of fixtures){
    let identity;
    try{identity=await service.login(fixture.name,fixture.password);}catch(error){if(!fixture.pendingPassword)throw error;identity=await service.login(fixture.name,fixture.pendingPassword);fixture.password=fixture.pendingPassword;}
    if(identity.mustChangePassword){
      fixture.pendingPassword=`New!9${randomBytes(18).toString('base64url')}`;
      await writeFile(file,JSON.stringify(fixtures),{mode:0o600});
      await service.changePassword(identity,fixture.password,fixture.pendingPassword);
      fixture.password=fixture.pendingPassword;delete fixture.pendingPassword;
      await writeFile(file,JSON.stringify(fixtures),{mode:0o600});
      identity=(await service.authenticate(service.cookie(identity)))!;
      if(!identity||identity.mustChangePassword)throw Error('PASSWORD_INITIALIZATION');
    }
    identities.push(identity);
  }
  const alice=identities[0],bob=identities[1],initial=await service.load(alice);
  const expected={favorites:[{recipeId:'tomato-egg',variantId:'tomato-egg-light'}],defaults:defaultMeal()};
  const saved=await service.save(alice,initial.version,expected);
  const resumed=(await new CloudBaseAccounts(opts).authenticate(service.cookie(alice)))!;
  if(JSON.stringify((await service.load(resumed)).value)!==JSON.stringify(expected))throw Error('CROSS_INSTANCE_STATE');
  let conflict=false;try{await service.save(alice,initial.version,{favorites:[],defaults:null});}catch(error){conflict=(error as any).code==='SYNC_CONFLICT';}
  if(!conflict)throw Error('CAS_CONFLICT');
  const other=await service.load(bob);if(other.value.favorites.length)throw Error('OWNER_ISOLATION');
  const response=await fetch(`https://${opts.envId}.api.tcloudbasegateway.com/v1/rdb/rest/shiwei_account_state?owner_id=eq.${alice.userId}&select=owner_id,envelope`,{headers:{Authorization:`Bearer ${bob.token}`},signal:AbortSignal.timeout(8000)});
  if(!response.ok||(await response.json()).length!==0)throw Error('DIRECT_RLS');
  const own=await fetch(`https://${opts.envId}.api.tcloudbasegateway.com/v1/rdb/rest/shiwei_account_state?select=envelope`,{headers:{Authorization:`Bearer ${alice.token}`},signal:AbortSignal.timeout(8000)});
  const raw=await own.text();if(!own.ok||raw.includes('tomato-egg')||raw.includes('servings'))throw Error('PLAINTEXT_STATE');
  await service.save(alice,saved.version,{favorites:[],defaults:null});
  const cookie=service.cookie(alice);await service.logout(alice);
  if(await new CloudBaseAccounts(opts).authenticate(cookie))throw Error('LOGOUT_REVOCATION');
  await service.logout(bob);
  await mkdir('artifacts/acceptance/account-ingredients-2026-10-24',{recursive:true});
  const report={verifiedAt:new Date().toISOString(),realCloudBaseLogin:true,firstPasswordChange:true,crossInstanceEncryptedSync:true,casConflict:true,directRlsIsolation:true,plaintextAbsent:true,logoutRevocation:true,fixtureOnly:true,credentialsPrinted:false};
  await writeFile('artifacts/acceptance/account-ingredients-2026-10-24/cloud-account-verification.json',JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify(report));
}
main().catch(error=>{console.error('CLOUD_ACCOUNT_VERIFY_FAILED',error?.code??error?.name??'Error');process.exitCode=1;});
