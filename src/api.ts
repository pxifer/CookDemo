import type { Extraction, RecommendationRequest, RecommendationResult } from '../shared/types';
import type { SessionInfo } from '../shared/session';
import type { ContentSnapshot } from '../shared/content';
import { settingsFields } from '../shared/account';
let csrf: string | null = null;
let contentVersion: string | undefined;
export class ApiError extends Error { constructor(message:string,public status:number,public code:string){super(message);} }
export async function fetchCatalog(): Promise<ContentSnapshot> {
  const response = await fetch('/api/v1/catalog/recipes', { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('菜谱内容暂不可用，草稿已保留，请稍后重试');
  const data: ContentSnapshot = await response.json();
  if (!data.contentVersion || !Array.isArray(data.foods) || !Array.isArray(data.recipes) || !data.recipes.length || !Array.isArray(data.categories)) throw new Error('菜谱内容不完整，草稿已保留');
  contentVersion = data.contentVersion; return data;
}
export async function establishSession(withState=false): Promise<SessionInfo> {
  const response = await fetch(`/api/v1/auth/session${withState?'?state=1':''}`,{signal:AbortSignal.timeout(25000)});
  if (!response.ok) throw new Error('本机会话建立失败，请刷新重试');
  const data: SessionInfo = await response.json(); csrf = data.csrfToken; return data;
}
async function post(url: string, body: unknown, signal?: AbortSignal, stream = false) {
  if (!csrf) await establishSession();
  if (contentVersion && ['recognitions/text','recommendations'].includes(url)) body = { ...(body as object), contentVersion };
  const response = await fetch(`/api/v1/${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf!, Accept: stream ? 'application/x-ndjson' : 'application/json' }, body: JSON.stringify(body), signal:signal??AbortSignal.timeout(25000) }).catch(error=>{if(error.name==='TimeoutError')throw Error('连接超时，输入已保留，请稍后重试');throw error;});
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.error?.message ?? '本次请求失败，输入已保留',response.status,error.error?.code??'REQUEST_FAILED');
  }
  return response;
}
export async function extract(text: string): Promise<Extraction> { return (await post('recognitions/text', { text })).json(); }
export async function sendHealthChat(body: import('../shared/health-chat').HealthChatRequest, signal: AbortSignal): Promise<import('../shared/health-chat').HealthChatReply> {
  const data = await (await post('health/chat', body, signal)).json();
  if (data.operationId !== body.operationId || data.message?.role !== 'assistant' || typeof data.message.content !== 'string' || !data.message.content.trim()) throw new Error('AI 回复不完整，请手动重试');
  return data;
}
export async function loginForLocalTest(): Promise<SessionInfo> {
  await post('auth/login', { mode: 'local-test' });
  return establishSession();
}
export async function logout(): Promise<SessionInfo> {
  await post('auth/logout', {});
  return establishSession();
}
export async function loginAccount(username:string,password:string,captcha?:{challenge:string;key:string}) {await post('auth/login',{username,password,...(captcha?{captcha}:{})});return establishSession(true);}
export async function registrationCode(email:string,captcha?:{challenge:string;key:string}):Promise<import('../shared/registration').RegistrationCode>{return (await post('auth/registration/code',{email,...(captcha?{captcha}:{})})).json();}
export async function registrationCaptcha():Promise<import('../shared/registration').CaptchaImage>{return (await post('auth/registration/captcha',{})).json();}
export async function registerAccount(input:import('../shared/registration').RegistrationInput){
  try{await post('auth/register',input);}
  catch(error){
    if(error instanceof ApiError&&error.code==='REGISTRATION_LOGIN_PENDING')throw new ApiError('账号已创建，但登录尚未完成。请切换到登录，使用刚设置的用户名和密码登录。',error.status,error.code);
    if(error instanceof ApiError&&error.code==='REGISTRATION_UNCONFIRMED')throw new ApiError('未能确认注册结果，请先使用刚填写的用户名和密码尝试登录。',error.status,error.code);
    throw error;
  }
  try{
    const session=await establishSession(true);
    if(session.identity!=='account'||!session.userId)throw new Error('ACCOUNT_SESSION_MISSING');
    return session;
  }catch{throw new ApiError('账号已创建，但未能确认登录状态。请切换到登录，使用刚设置的用户名和密码登录。',503,'REGISTRATION_LOGIN_PENDING');}
}
export async function loadAccount():Promise<import('../shared/account').AccountSnapshot> {
  const response=await fetch('/api/v1/account/state',{signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new ApiError('账户内容读取失败，本机修改已保留',response.status,'ACCOUNT_READ_FAILED');
  return response.json();
}
export async function saveAccount(expectedVersion:number,value:import('../shared/account').AccountValue):Promise<import('../shared/account').AccountSnapshot> {return (await post('account/state',{expectedVersion,value:{...value,defaults:value.defaults?settingsFields(value.defaults):null}})).json();}
export async function changeAccountPassword(oldPassword:string,newPassword:string) {await post('account/password',{oldPassword,newPassword});}
export async function requestRecommendation(body: RecommendationRequest, signal: AbortSignal, progress: (s: string) => void): Promise<RecommendationResult> {
  const response = await post('recommendations', body, signal, true);
  if (!response.body) throw new Error('结果连接未建立，请主动重试');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', terminal: RecommendationResult | null = null;
  let ended = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (ended) throw new Error('结果流包含重复终态');
    if (event.type === 'progress') progress(event.stage);
    else if (event.type === 'error') { ended = true; throw new Error(event.message); }
    else if (event.type === 'result') { ended = true; terminal = event.result; }
    else throw new Error('无法识别的结果协议');
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n'); buffer = lines.pop()!;
      for (const line of lines) consume(line);
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!terminal) throw new Error('结果连接中断，请主动重试；未自动重新发送');
    return terminal;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
