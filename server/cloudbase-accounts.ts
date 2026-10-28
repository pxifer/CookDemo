import { defaultMeal as importDefaultMeal } from '../shared/types';
import { createHash, randomBytes } from 'node:crypto';
import { open, seal, type Envelope } from './crypto';
import { DomainError } from './recommendation';
import type { HealthProfile } from '../shared/health-chat';
import { combinedTopicChoices, healthTopics, migrateHealthProfile } from '../shared/health-topics';
import type { AccountSnapshot, AccountValue } from '../shared/account';
import { emptyAccount, personalSettings, settingsFields } from '../shared/account';
import { validEmail, validUsername, validNewPassword, type RegistrationCode, type RegistrationInput, type CaptchaImage } from '../shared/registration';

export interface AccountIdentity { userId:string; displayName:string; mustChangePassword:boolean; token:string; sid:string; device:string; expires:number }
export interface Accounts {
  readonly registrationAvailable?: boolean;
  registrationCode?(email:string,subject:string,captcha?:{challenge:string;key:string}):Promise<RegistrationCode>;
  register?(input:RegistrationInput,subject:string):Promise<AccountIdentity>;
  captcha?(subject:string):Promise<CaptchaImage>;
  login(username:string,password:string,verification?:{subject:string;captcha?:{challenge:string;key:string}}):Promise<AccountIdentity>;
  authenticate(cookie:string|undefined):Promise<AccountIdentity|null>;
  cookie(identity:AccountIdentity|null):string;
  load(identity:AccountIdentity):Promise<AccountSnapshot>;
  save(identity:AccountIdentity,expected:number,value:AccountValue):Promise<AccountSnapshot>;
  healthKey?(identity:AccountIdentity):Promise<{apiKey:string;profile?:HealthProfile;restrictions:import('../shared/types').Restriction[];preferences?:import('../shared/health-chat').AiFoodChoices}>;
  setHealthKey?(identity:AccountIdentity,expected:number,apiKey:string|null):Promise<AccountSnapshot>;
  saveHealthGuidance?(identity:AccountIdentity,profile:HealthProfile,key:string,expectedProfile?:HealthProfile):Promise<AccountSnapshot>;
  logout(identity:AccountIdentity):Promise<void>;
  changePassword(identity:AccountIdentity,oldPassword:string,newPassword:string):Promise<void>;
  claimAiChat?(identity:AccountIdentity,operationId:string,fingerprint:string):Promise<{claimed:boolean;reason:string}>;
}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const unauthorized=()=>new DomainError('LOGIN_REQUIRED',401,'登录已失效，请重新登录；本机修改会保留');
export class CloudBaseAccounts implements Accounts {
  private base:string;
  constructor(private options:{envId:string;cookieKey:Buffer;profileKey:Buffer;keyVersion:string;registrationEnabled?:boolean;fetch?:typeof fetch}) {
    if(options.envId!=='shiwei-d2gmiun66b7dc6a4f'||options.cookieKey.length!==32||options.profileKey.length!==32||options.cookieKey.equals(options.profileKey)||!/^[a-z0-9-]{1,50}$/.test(options.keyVersion))throw Error('ACCOUNT_CONFIGURATION');
    this.base=`https://${options.envId}.api.tcloudbasegateway.com`;
  }
  get registrationAvailable(){return this.options.registrationEnabled===true;}
  private async request(path:string,token?:string,body?:unknown,method=body===undefined?'GET':'POST',device?:string,captchaToken?:string) {
    let response:Response;
    try { response=await (this.options.fetch??fetch)(`${this.base}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(device?{'x-device-id':device}:{}),...(captchaToken?{'x-captcha-token':captchaToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(8000),redirect:'error'}); }
    catch {throw new DomainError('ACCOUNT_UNAVAILABLE',503,'账户服务暂不可用，本机修改会保留');}
    if(!response.ok) {
      if(path.includes('/verification')||path.includes('/captcha/')||path==='/auth/v1/signup'||path==='/auth/v1/signin') {
        // Only inspect a bounded vendor error identifier, never relay raw bodies,
        // email addresses, verification tokens, credentials or request details.
        const error=await response.json().catch(()=>({})),code=String(error.error??'').slice(0,100);
        if(code==='captcha_required')throw new DomainError('CAPTCHA_REQUIRED',400,'请先完成图片验证后重试');
        if(path==='/auth/v1/signin'&&/captcha/.test(code))throw new DomainError('INVALID_CAPTCHA',400,'图片验证码不正确或已过期，请换一张重试');
        if(response.status===429||/rate_limit|too_many|frequency/.test(code))throw new DomainError('VERIFICATION_RATE_LIMIT',429,'操作太频繁，请稍后再试');
        if(/disabled|not_enabled|smtp|send_email|email_send/.test(code))throw new DomainError('REGISTRATION_UNAVAILABLE',503,'邮箱验证暂不可用，请稍后重试');
        if(path==='/auth/v1/signup'&&/password/.test(code))throw new DomainError('WEAK_PASSWORD',400,'密码需为8～32位并包含大小写字母、数字和符号，请修改后重新获取验证码');
        if(path==='/auth/v1/signup'&&/invalid_username|username_invalid/.test(code))throw new DomainError('INVALID_USERNAME',400,'用户名格式不符合要求，请使用5～24位字母、数字、点、下划线或短横线，并重新获取验证码');
        if(path==='/auth/v1/signup'&&/exist|already|taken|conflict|precondition/.test(code))throw new DomainError('ACCOUNT_EXISTS',409,'用户名或邮箱已注册，请登录或更换用户名');
        if(path.includes('/captcha/'))throw new DomainError('INVALID_CAPTCHA',400,'图片验证码不正确或已过期，请换一张重试');
        if(path.includes('/verification/verify'))throw new DomainError('INVALID_VERIFICATION',400,'邮箱验证码不正确或已过期，请检查后重试');
        if(response.status<500&&path!=='/auth/v1/signin')throw new DomainError('REGISTRATION_REJECTED',400,'注册未完成，请检查用户名、邮箱和验证码后重试');
      }
      if([400,401,403].includes(response.status))throw unauthorized();
      throw new DomainError('ACCOUNT_UNAVAILABLE',503,'账户服务暂不可用，本机修改会保留');
    }
    return response.json();
  }
  private registrationRequired(){if(!this.registrationAvailable)throw new DomainError('REGISTRATION_UNAVAILABLE',503,'注册暂不可用，请稍后重试');}
  private challenge(value:unknown,subject:string,purpose:string){
    return Buffer.from(JSON.stringify(seal(value,this.options.cookieKey,subject,purpose,'registration-v1'))).toString('base64url');
  }
  private readChallenge<T extends {expires:number}>(value:string,subject:string,purpose:string):T {
    try{
      const data=open(JSON.parse(Buffer.from(value,'base64url').toString()),this.options.cookieKey,subject,purpose) as T;
      if(!data||!Number.isFinite(data.expires)||data.expires<=Date.now())throw Error('EXPIRED');
      return data;
    }catch{throw new DomainError('VERIFICATION_EXPIRED',400,'验证已过期，请重新获取验证码');}
  }
  async captcha(subject:string):Promise<CaptchaImage>{
    const device=randomBytes(16).toString('hex'),value=await this.request('/auth/v1/captcha/data',undefined,{},'POST',device);
    if(typeof value.token!=='string'||typeof value.data!=='string'||value.data.length>256000||!/^data:image\/(gif|png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(value.data))throw new DomainError('REGISTRATION_UNAVAILABLE',503,'图片验证暂不可用，请稍后重试');
    return {image:value.data,challenge:this.challenge({token:value.token,device,expires:Date.now()+300000},subject,'registration-captcha')};
  }
  async registrationCode(email:string,subject:string,captcha?:{challenge:string;key:string}):Promise<RegistrationCode>{
    this.registrationRequired();
    if(!validEmail(email))throw new DomainError('INVALID_EMAIL',400,'请输入有效的邮箱地址');
    let device=randomBytes(16).toString('hex'),captchaToken:string|undefined;
    if(captcha){
      const data=this.readChallenge<{token:string;device:string;expires:number}>(captcha.challenge,subject,'registration-captcha');device=data.device;
      const result=await this.request('/auth/v1/captcha/data/verify',undefined,{token:data.token,key:captcha.key},'POST',device);
      if(typeof result.captcha_token!=='string')throw new DomainError('INVALID_CAPTCHA',400,'图片验证失败，请重试');captchaToken=result.captcha_token;
    }
    const result=await this.request('/auth/v1/verification',undefined,{email,target:'ANY'},'POST',device,captchaToken);
    if(typeof result.verification_id!=='string')throw new DomainError('REGISTRATION_UNAVAILABLE',503,'验证码暂不可用，请重试');
    const expiresIn=Math.max(1,Math.min(600,Number(result.expires_in)||600));
    return {challenge:this.challenge({email,verificationId:result.verification_id,device,expires:Date.now()+expiresIn*1000},subject,'registration-email'),expiresIn};
  }
  async register(input:RegistrationInput,subject:string):Promise<AccountIdentity>{
    this.registrationRequired();
    if(!validUsername(input.username)||!validNewPassword(input.password)||!/^\d{6}$/.test(input.code))throw new DomainError('INVALID_REGISTRATION',400,'请检查用户名、密码和六位邮箱验证码');
    const data=this.readChallenge<{email:string;verificationId:string;device:string;expires:number}>(input.challenge,subject,'registration-email');
    const verified=await this.request('/auth/v1/verification/verify',undefined,{verification_id:data.verificationId,verification_code:input.code},'POST',data.device);
    if(typeof verified.verification_token!=='string')throw new DomainError('INVALID_VERIFICATION',400,'邮箱验证未完成，请重试');
    const value=await this.request('/auth/v1/signup',undefined,{email:data.email,verification_token:verified.verification_token,username:input.username,password:input.password},'POST',data.device);
    if(typeof value.sub!=='string'||!value.sub||value.sub==='anon'||typeof value.access_token!=='string')throw new DomainError('REGISTRATION_UNCONFIRMED',502,'未能确认注册结果，请先尝试登录');
    try{
      const identity=await this.identity(value,input.username,data.device);
      // This password was chosen by its verified owner, not issued by an inviter.
      // Initialize only AFTER official signup and token introspection both succeed.
      await this.rpc(identity,'shiwei_password_initialized');identity.mustChangePassword=false;
      return identity;
    }catch{throw new DomainError('REGISTRATION_LOGIN_PENDING',503,'注册服务已受理，但登录尚未完成。请使用刚设置的用户名和密码登录');}
  }
  private rpc(identity:AccountIdentity,name:string,args:Record<string,unknown>={}) {
    return this.request(`/v1/rdb/rest/rpc/${name}`,identity.token,{p_session:hash(identity.sid),...args});
  }
  async login(username:string,password:string,verification?:{subject:string;captcha?:{challenge:string;key:string}}):Promise<AccountIdentity> {
    let device=randomBytes(16).toString('hex'),captchaToken:string|undefined;
    if(verification?.captcha){
      const data=this.readChallenge<{token:string;device:string;expires:number}>(verification.captcha.challenge,verification.subject,'registration-captcha');device=data.device;
      const result=await this.request('/auth/v1/captcha/data/verify',undefined,{token:data.token,key:verification.captcha.key},'POST',device);
      if(typeof result.captcha_token!=='string')throw new DomainError('INVALID_CAPTCHA',400,'图片验证失败，请重试');captchaToken=result.captcha_token;
    }
    let value;
    try {value=await this.request('/auth/v1/signin',undefined,{username,password},'POST',device,captchaToken);}
    catch(error){if(error instanceof DomainError&&error.statusCode===401)throw new DomainError('INVALID_LOGIN',401,'用户名或密码不正确');throw error;}
    return this.identity(value,username,device);
  }
  private async identity(value:{access_token?:unknown;sub?:unknown;expires_in?:unknown},username:string,device:string):Promise<AccountIdentity>{
    if(typeof value.access_token!=='string'||typeof value.sub!=='string'||value.sub==='anon')throw unauthorized();
    const verified=await this.request('/auth/v1/token/introspect',value.access_token,undefined,'GET',device);
    if(verified.sub!==value.sub)throw unauthorized();
    const expires=Date.now()+Math.min(1800,Number(value.expires_in)||1800)*1000;
    const identity:AccountIdentity={userId:value.sub,displayName:username,token:value.access_token,sid:randomBytes(32).toString('hex'),device,expires,mustChangePassword:true};
    const record=await this.request('/v1/rdb/rest/rpc/shiwei_session_start',identity.token,{p_session:hash(identity.sid),p_expires:new Date(expires).toISOString()});
    identity.mustChangePassword=!record.password_initialized;
    return identity;
  }
  cookie(identity:AccountIdentity|null) {
    const value=identity?Buffer.from(JSON.stringify(seal(identity,this.options.cookieKey,'session','account-cookie','account-cookie-v1'))).toString('base64url'):'';
    if(value.length>3700)throw new DomainError('ACCOUNT_UNAVAILABLE',503,'账户会话暂不可用，请重试');
    return `shiwei_account=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${identity?Math.max(0,Math.floor((identity.expires-Date.now())/1000)):0}`;
  }
  async authenticate(cookie:string|undefined) {
    const value=cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('shiwei_account='))?.slice(15);
    if(!value)return null;
    let identity:AccountIdentity;
    try { identity=open(JSON.parse(Buffer.from(value,'base64url').toString()),this.options.cookieKey,'session','account-cookie') as AccountIdentity; }
    catch {return null;}
    if(!identity||typeof identity.sid!=='string'||identity.expires<=Date.now())return null;
    try {
      const [verified,active]=await Promise.all([this.request('/auth/v1/token/introspect',identity.token,undefined,'GET',identity.device),this.rpc(identity,'shiwei_session_check')]);
      if(verified.sub!==identity.userId)return null;
      if(!active.active)return null;
      identity.mustChangePassword=!active.password_initialized;
      return identity;
    } catch(error) {if(error instanceof DomainError&&error.statusCode===401)return null;throw error;}
  }
  private async privateState(identity:AccountIdentity){
    const result=await this.rpc(identity,'shiwei_account_load');
    const value=result.envelope?open(result.envelope as Envelope,this.options.profileKey,identity.userId,'account-state') as AccountValue&{healthApiKey?:string}:emptyAccount();
    if(value.defaults?.healthProfile&&!value.defaults.healthProfile.topics){
      const profile=migrateHealthProfile(value.defaults.healthProfile,value.defaults.aiFoodPreferences,value.defaults.aiExcludedFoods);
      value.defaults={...value.defaults,healthProfile:profile,aiFoodPreferences:combinedTopicChoices(healthTopics(profile)),aiExcludedFoods:[]};
    }
    return {version:result.version,value:value as AccountValue&{healthApiKey?:string}};
  }
  private publicState(state:{version:number;value:AccountValue&{healthApiKey?:string}}):AccountSnapshot{
    const {value,version}=state;
    return {version,value:{favorites:value.favorites,defaults:value.defaults?personalSettings(value.defaults):null},healthKey:{configured:Boolean(value.healthApiKey),...(value.healthApiKey?{last4:value.healthApiKey.slice(-4)}:{})}};
  }
  async load(identity:AccountIdentity):Promise<AccountSnapshot>{return this.publicState(await this.privateState(identity));}
  private async writePrivate(identity:AccountIdentity,expected:number,value:AccountValue&{healthApiKey?:string}){
    if(identity.mustChangePassword)throw new DomainError('PASSWORD_CHANGE_REQUIRED',403,'请先修改初始密码');
    const envelope=seal({...value,defaults:value.defaults?settingsFields(value.defaults):null},this.options.profileKey,identity.userId,'account-state',this.options.keyVersion);
    const result=await this.rpc(identity,'shiwei_account_save',{p_expected:expected,p_envelope:envelope});
    if(result.conflict)throw new DomainError('SYNC_CONFLICT',409,'账户内容已在另一设备修改，请刷新设置后重试');
    return this.publicState({version:result.version,value});
  }
  async save(identity:AccountIdentity,expected:number,value:AccountValue):Promise<AccountSnapshot>{
    const current=await this.privateState(identity);
    if(current.version!==expected)throw new DomainError('SYNC_CONFLICT',409,'账户内容已在另一设备修改，请核对差异后再保存');
    if(value.defaults?.healthProfile&&!value.defaults.healthProfile.topics){
      const profile=migrateHealthProfile(value.defaults.healthProfile,value.defaults.aiFoodPreferences,value.defaults.aiExcludedFoods);
      value={...value,defaults:{...value.defaults,healthProfile:profile,aiFoodPreferences:combinedTopicChoices(healthTopics(profile)),aiExcludedFoods:[]}};
    }
    if(value.defaults?.healthProfile?.topics){
      const profile=value.defaults.healthProfile,topics=healthTopics(profile);
      value={...value,defaults:{...value.defaults,healthProfile:{...profile,topics,suggestions:topics.flatMap(topic=>topic.suggestions).slice(-20)},aiFoodPreferences:combinedTopicChoices(topics)}};
    }else if(value.defaults&&current.value.defaults?.healthProfile?.topics&&!value.defaults.healthProfile){
      value={...value,defaults:{...value.defaults,aiFoodPreferences:{preferred:[],limited:[],excluded:[]},aiExcludedFoods:[]}};
    }
    return this.writePrivate(identity,expected,{favorites:value.favorites,defaults:value.defaults?personalSettings({...value.defaults,...(!Object.hasOwn(value.defaults,'aiFoodPreferences')&&current.value.defaults?.aiFoodPreferences?{aiFoodPreferences:current.value.defaults.aiFoodPreferences}:{})}):null,...(current.value.healthApiKey?{healthApiKey:current.value.healthApiKey}:{})});
  }
  async healthKey(identity:AccountIdentity){
    const current=await this.privateState(identity);
    const defaults=current.value.defaults;
    return {apiKey:current.value.healthApiKey??'',profile:defaults?.healthProfile,restrictions:defaults?.restrictions??[],preferences:defaults?.healthProfile?.topics?combinedTopicChoices(healthTopics(defaults.healthProfile)):defaults?.aiFoodPreferences};
  }
  async setHealthKey(identity:AccountIdentity,expected:number,apiKey:string|null){
    if(apiKey!==null&&!/^sk-[A-Za-z0-9_-]{16,250}$/.test(apiKey))throw new DomainError('INVALID_KEY',400,'请输入以 sk- 开头的 DeepSeek API Key');
    const current=await this.privateState(identity);
    if(current.version!==expected)throw new DomainError('SYNC_CONFLICT',409,'个人设置已变更，请刷新后重新保存Key');
    return this.writePrivate(identity,expected,{...current.value,healthApiKey:apiKey??undefined});
  }
  async saveHealthGuidance(identity:AccountIdentity,profile:HealthProfile,key:string,expectedProfile?:HealthProfile){
    for(let attempt=0;attempt<3;attempt++){
      const current=await this.privateState(identity);
      if(current.value.healthApiKey!==key)throw new DomainError('CHAT_KEY_CHANGED',409,'Key 已变更，本次回复未保存，请使用当前设置继续');
      if(JSON.stringify(current.value.defaults?.healthProfile)!==JSON.stringify(expectedProfile))throw new DomainError('CHAT_PROFILE_CHANGED',409,'健康档案已在其他操作中修改，本次建议未覆盖新设置');
      const defaults=current.value.defaults??personalSettings(importDefaultMeal());
      try{return await this.writePrivate(identity,current.version,{...current.value,defaults:{...defaults,healthProfile:profile,...(profile.topics?{aiFoodPreferences:combinedTopicChoices(healthTopics(profile))}:{})}});}
      catch(error){if(!(error instanceof DomainError&&error.code==='SYNC_CONFLICT')||attempt===2)throw error;}
    }
    throw new DomainError('SYNC_CONFLICT',409,'健康建议暂未保存，请稍后检查个人设置');
  }
  async logout(identity:AccountIdentity) { await this.rpc(identity,'shiwei_session_end'); }
  async claimAiChat(identity:AccountIdentity,operationId:string,fingerprint:string) {
    const value=await this.rpc(identity,'shiwei_ai_chat_claim',{p_operation:operationId,p_fingerprint:fingerprint});
    if(typeof value?.claimed!=='boolean'||!['claimed','duplicate','limit'].includes(value.reason))throw new DomainError('CHAT_NOT_READY',503,'AI 对话暂时无法连接，请稍后再试');
    return value as {claimed:boolean;reason:string};
  }
  async changePassword(identity:AccountIdentity,oldPassword:string,newPassword:string) {
    // Official SDK 3.6.3 resetPasswordForOld: sudo(old password), then setPassword(sudo token).
    const sudo=await this.request('/auth/v1/user/sudo',identity.token,{password:oldPassword},'POST',identity.device);
    if(typeof sudo.sudo_token!=='string')throw unauthorized();
    await this.request('/auth/v1/user/password',identity.token,{sudo_token:sudo.sudo_token,new_password:newPassword},'PATCH',identity.device);
    await this.rpc(identity,'shiwei_password_initialized');
  }
}
