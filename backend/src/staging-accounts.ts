import type { Accounts,AccountIdentity } from './cloudbase-accounts';
import { DomainError } from './recommendation';
export function stagingAccounts(accounts:Accounts,allowedIds:readonly string[],options:{passwordRecoveryEnabled?:boolean}={}):Accounts{
  const allowed=new Set(allowedIds);
  const permitted=(identity:AccountIdentity)=>{if(!allowed.has(identity.userId))throw new DomainError('STAGING_ACCOUNT_REQUIRED',403,'该验证入口仅允许指定测试账号');return identity;};
  return new Proxy(accounts,{get(target,key){
    if(key==='registrationAvailable')return false;
    if(key==='recoveryAvailable')return options.passwordRecoveryEnabled===true&&target.recoveryAvailable===true;
    if(key==='authenticate')return async(cookie:string|undefined)=>{const identity=await target.authenticate(cookie);return identity&&allowed.has(identity.userId)?identity:null;};
    if(key==='login')return async(...args:Parameters<Accounts['login']>)=>{const identity=await target.login(...args);try{return permitted(identity);}catch(error){await target.logout(identity);throw error;}};
    if(key==='register'||key==='registrationCode'||((key==='recoveryCode'||key==='recoverPassword')&&options.passwordRecoveryEnabled!==true))return async()=>{throw new DomainError('STAGING_ACCOUNT_REQUIRED',403,'此验证入口不向非指定账号开放');};
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
}
