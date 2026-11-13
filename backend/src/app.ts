import { healthChatRecipes, expandFoodSuggestions, withoutExistingRestrictions, withoutRepeatedFoodText, mergeHealthProfile } from '../../shared/health-guidance';
import { healthTopics } from '../../shared/health-topics';
import { createHealthRecipeSelector } from './health-recipe-selection';
import type { FoodGuidanceProvider } from '../../shared/food-guidance';
import { balancedFoodSuggestions, researchFoodChat } from './rag/food-guidance-chat';
import {recommendationMeal} from '../../shared/recommendation-input';
import Fastify, { type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractText } from '../../shared/extraction';
import { constructedContent } from '../../shared/catalog';
import { contentContext, type ContentContext } from '../../shared/content';
import { CONTENT_VERSION, type Dish, type Recipe, type RecommendationRequest } from '../../shared/types';
import { extractionSchema, recommendationSchema, mealSchema, personalSettingsSchema } from '../../shared/schema';
import { personalSettings } from '../../shared/account';
import type { Accounts } from './cloudbase-accounts';
import type { AccountValue } from '../../shared/account';
import { validEmail, validNewPassword, type RegistrationInput } from '../../shared/registration';
import { assertMeal, DomainError, recommend } from './recommendation';
import type { Database } from './db';
import { inspectDatabase } from './deployment';
import { ContentRepository } from './content-repository';
import { GALLERY_RELEASE, GalleryContentRepository, readCandidateRows } from './gallery-content';
import { recipeImage } from '../../shared/recipe-images';
import { fixedRecipeText, ingredientDisplayText } from '../../shared/recipe-copy';
import methodReview from '../../datasets/recipes/curation/recipe-step-review-v28.json';
import type { HealthModel } from './health-model';
import { requestHealthChat, during, assertChat } from './health-chat';
import { recognizeImage, validateImage, type ImageModelConfig } from './image-recognition';
import { imageRecognitionSchema, type ImageRecognitionRequest } from '../../shared/image-recognition';
import { healthChatSchema, type HealthChatRequest } from '../../shared/health-chat';

type MethodCopy={steps:string[];method_options?:{label:string;steps:string[]}[]};
const reviewedMethods=methodReview.recipes as Record<string,MethodCopy>;
const reviewedMethod=(id:string|undefined)=>{
  const record=id?.match(/(?:^|-)([RS]\d+)$/i)?.[1]?.toUpperCase();
  return record?reviewedMethods[record]:undefined;
};

const publicAttribution=(author:string|undefined,uri:string|undefined)=>uri?.startsWith('https://')&&author&&!/(拾味|候选|未试做|自编|内部|待核)/.test(author)
  ? {label:author.replace(/\s*[·•]?\s*公开配方资料[；;]\s*保留原始出处\s*$/,'').trim(),url:uri} : undefined;
const publicText=(value:string)=>fixedRecipeText(value).replace(/[（(][^）)]*(?:待核|未试做|内部候选|许可核验|原文名称)[^）)]*[）)]/g,'')
  .replace(/来源此支/g,'').replace(/按来源/g,'').replace(/来源两面/g,'两面').replace(/来源用约/g,'用约')
  .replace(/来源加盖/g,'加盖').replace(/来源两段/g,'两段').replace(/来源允许自行选加料酒、胡椒粉/g,'料酒、胡椒粉可按口味添加')
  .replace(/来源允许出锅前少量花椒油/g,'出锅前可放少量花椒油').replace(/按原简介/g,'').trim();
const publicList=(items:string[]|undefined)=>items?.map(publicText).filter(Boolean);
const publicIngredients=(items:string[]|undefined)=>items?.map(text=>ingredientDisplayText(publicText(text))).filter(Boolean);
const publicRecipe=(recipe:Recipe)=>{
  const {source,variants,...publicFields}=recipe;
  const attribution=publicAttribution(source.author,source.uri);
  return {...publicFields,...(attribution?{publicAttribution:attribution}:{}),variants:variants.map(({reviewNotes,ingredientNotes,steps,methodOptions,lines,...variant})=>{
    const edited=reviewedMethod(variant.id)??(variants.length===1?reviewedMethod(source.recordId):undefined);
    const methods=edited?.method_options??methodOptions;
    return {...variant,steps:(edited?.steps??steps).map(publicText),lines:lines.map(line=>({...line,...(line.sourceText?{sourceText:ingredientDisplayText(publicText(line.sourceText))}:{})})),
      ...(methods?.length?{methodOptions:methods.map(method=>({label:publicText(method.label),steps:method.steps.map(publicText)}))}:{})};
  })};
};
const publicDish=(dish:Dish)=>{
  const recipe=publicRecipe(dish.recipe);
  return {...dish,recipe,variant:recipe.variants.find(variant=>variant.id===dish.variant.id)!};
};
const publicRecipeRow=(row:import('./gallery-content').CandidateRow)=>({
  dish_key:row.dish_key,flavor:row.flavor,image_url:row.image_url,
  ...(publicAttribution(row.raw_record.author,row.source_uri)
    ? {publicAttribution:publicAttribution(row.raw_record.author,row.source_uri)} : {}),
  raw_record:{id:row.raw_record.id,category:row.raw_record.category,main:publicIngredients(row.raw_record.main),aux:publicIngredients(row.raw_record.aux),
    seasonings:publicIngredients(row.raw_record.seasonings),...(()=>{const edited=reviewedMethod(row.raw_record.id),steps=edited?.steps??row.raw_record.steps,options=edited?.method_options??row.raw_record.method_options??[],primary=steps?.length?undefined:options[0],start=primary?1:0;
      return {steps:publicList(steps?.length?steps:primary?.steps),...(primary?.label?{main_method_label:publicText(primary.label)}:{}),
        method_options:options.slice(start).map(method=>({label:publicText(method.label),steps:publicList(method.steps)}))};})()},
});

export async function createApp(options: {
  staticRoot?: string; origin?: string; localTestFeatures?: boolean;
  sessionSecret?: Buffer; csrfSecret?: Buffer; database?: Database;
  environment?: 'local' | 'preview' | 'staging' | 'production'; contentSource?: 'constructed' | 'pending' | 'database' | 'cloudbase' | 'local-cache'; contentRelease?: string; requireVector?: boolean;
  contentRepository?: {load(release:string):Promise<import('../../shared/content').ContentSnapshot>;candidates():Promise<import('./gallery-content').CandidateRow[]>};
  accounts?: Accounts;
  healthModel?: HealthModel;
  healthChatFetch?: typeof fetch;
  imageModel?: ImageModelConfig;
  imageRecognitionFetch?: typeof fetch;
  healthRecipeFetch?: typeof fetch;
  healthRecipeObserve?: (diagnostics:import('./health-recipe-selection').SelectionDiagnostics)=>void;
  foodGuidance?:FoodGuidanceProvider;
  publishedKnowledge?:FoodGuidanceProvider;
  sharedRecommendationTasks?:boolean;
} = {}) {
  if(options.foodGuidance&&options.publishedKnowledge)throw new Error('Choose one guidance provider');
  if(options.foodGuidance&&(options.environment!=='local'||!options.origin||!['127.0.0.1','localhost','[::1]'].includes(new URL(options.origin).hostname)))throw new Error('Research food guidance requires explicit local loopback configuration');
  if(options.contentSource==='local-cache'&&(options.environment!=='local'||!options.origin||!['127.0.0.1','localhost','[::1]'].includes(new URL(options.origin).hostname)||!options.contentRepository||!options.contentRelease))throw new Error('Local cached content requires explicit local loopback configuration');
  if(options.contentSource==='cloudbase' && (options.environment!=='preview'||!options.contentRepository||options.contentRelease!==GALLERY_RELEASE||!options.origin?.startsWith('https:')||!options.sessionSecret||!options.csrfSecret||options.localTestFeatures))throw new Error('CloudBase preview configuration required');
  if(options.contentRepository&&!['cloudbase','local-cache'].includes(options.contentSource??''))throw new Error('Explicit content repository source required');
  if (options.contentSource === 'database' && (options.environment !== 'local' || !options.database || !options.contentRelease)) throw new Error('Database fixture content requires explicit local configuration');
  const repository = ['cloudbase','local-cache'].includes(options.contentSource??'') ? options.contentRepository : options.contentSource === 'database' ? (options.contentRelease === GALLERY_RELEASE ? new GalleryContentRepository(options.database!) : new ContentRepository(options.database!)) : undefined;
  const contexts = new WeakMap<FastifyRequest, ContentContext>();
  const contextFor = (req: FastifyRequest) => {
    const context = contexts.get(req);
    if (repository && !context) throw new DomainError('CONTENT_NOT_READY',503,'内容暂不可用，请保留输入后重试');
    return context ?? constructedContent;
  };
  const localTestFeatures = options.localTestFeatures === true;
  const healthChatAvailable = localTestFeatures || Boolean(options.accounts?.claimAiChat);
  const localChatClaims = new Map<string, number>();
  let chatsInFlight = 0;
  if (localTestFeatures && options.origin && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(options.origin).hostname)) throw new Error('Local test identity is restricted to loopback origins');
  if (localTestFeatures && options.environment && options.environment !== 'local') throw new Error('Local test identity is restricted to loopback environments');
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, ajv: { customOptions: { coerceTypes: false, removeAdditional: false } } });
  const secret = options.sessionSecret ?? randomBytes(32), csrfSecret = options.csrfSecret ?? randomBytes(32);
  if (secret.length !== 32 || csrfSecret.length !== 32) throw new Error('Invalid session configuration');
  const recommendationCursorSecret = createHmac('sha256', secret).update('shiwei/recommendation-cursor/v1').digest();
  const selectHealthRecipes=createHealthRecipeSelector(recommendationCursorSecret,options.foodGuidance??options.publishedKnowledge);
  const sign = (s: string) => createHmac('sha256', secret).update(s).digest('base64url');
  const signCsrf = (s: string) => createHmac('sha256', csrfSecret).update(s).digest('base64url');
  const equal = (a: string, b: string) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const latest = new Map<string, { version: number; operation: string; touched: number }>();
  const rate = new Map<string, { at: number; count: number }>();
  const registrationSends = new Map<string,number>();
  const registrationAvailable=()=>options.accounts?.registrationAvailable===true&&Boolean(options.accounts.registrationCode&&options.accounts.register&&options.accounts.captcha);
  const testSessions = new Map<string, { guest: string; expires: number }>();
  const prune = setInterval(() => {
    const cutoff = Date.now() - 30 * 60_000;
    for (const [k, v] of latest) if (v.touched < cutoff) latest.delete(k);
    for (const [k, v] of rate) if (v.at < cutoff) rate.delete(k);
    for (const [k, v] of registrationSends) if(v<cutoff)registrationSends.delete(k);
    for (const [k, v] of testSessions) if (v.expires <= Date.now()) testSessions.delete(k);
    for (const [k, v] of localChatClaims) if (v < cutoff) localChatClaims.delete(k);
  }, 60_000).unref();
  app.addHook('onClose', async () => { clearInterval(prune); });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer')
      .header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://raw.githubusercontent.com https://shiwei-d2gmiun66b7dc6a4f-1512010497.tcloudbaseapp.com data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
      .header('Cache-Control', 'no-store');
  });
  const session = (cookie: string | undefined) => {
    const token = cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('shiwei_guest='))?.slice(13);
    if (!token) return null;
    const parts = token.split('.');
    return parts.length === 2 && /^[a-f0-9]{32}$/.test(parts[0]) && equal(parts[1], sign(parts[0])) ? parts[0] : null;
  };
  const testSession = (cookie: string | undefined) => {
    if (!localTestFeatures) return null;
    const token = cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('shiwei_test_session='))?.slice('shiwei_test_session='.length);
    if (!token) return null;
    const current = testSessions.get(token);
    return current && current.guest === session(cookie) && current.expires > Date.now() ? token : null;
  };
  const testCookie = (token: string, maxAge: number) => `shiwei_test_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${options.origin?.startsWith('https:') ? '; Secure' : ''}`;
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    const subject = session(req.headers.cookie);
    if (!subject) throw new DomainError('SESSION_REQUIRED', 401, '请刷新页面建立本机会话');
    const origin = options.origin ?? `http://${req.headers.host}`;
    if (req.headers.origin !== origin || req.headers['x-csrf-token'] !== signCsrf(`csrf:${subject}`) || req.headers['sec-fetch-site'] === 'cross-site') throw new DomainError('ORIGIN_REJECTED', 403, '请求来源或会话校验失败，请刷新后重试');
    const bucket = rate.get(subject) ?? { at: Date.now(), count: 0 };
    if (Date.now() - bucket.at > 60_000) { bucket.at = Date.now(); bucket.count = 0; }
    if (++bucket.count > 60) { reply.header('Retry-After', '60'); throw new DomainError('RATE_LIMIT', 429, '本机会话请求过于频繁，请稍后重试'); }
    rate.set(subject, bucket);
  });
  app.addHook('preHandler', async req => {
    if (!['/api/v1/catalog/recipes', '/api/v1/recognitions/text', '/api/v1/recognitions/image', '/api/v1/recommendations'].includes(req.url.split('?')[0])) return;
    if (options.contentSource === 'pending') {
      throw new DomainError('CONTENT_NOT_READY', 503, '正式内容尚未录入，此环境暂不提供推荐');
    }
    const context = repository ? contentContext(await repository.load(options.contentRelease!)) : constructedContent;
    contexts.set(req,context);
    const supplied = (req.body as { contentVersion?: string } | undefined)?.contentVersion;
    if (supplied && supplied !== context.contentVersion) throw new DomainError('CONTENT_CHANGED',409,'内容版本已变化，请刷新页面后重试；输入已保留');
  });
  app.setErrorHandler((error, req, reply) => {
    const e = error as Error & { validation?: unknown; statusCode?: number; code?: string };
    const status = e.validation ? 400 : e.statusCode ?? 500;
    reply.code(status).send({ error: { code: e.validation ? 'INVALID_REQUEST' : e.code ?? 'INTERNAL_ERROR', message: e.validation ? '输入格式不合法，请检查人数、数量和已确认状态' : status < 500 || (e instanceof DomainError && e.code.startsWith('CHAT_')) ? e.message : '服务暂不可用，输入已保留', requestId: req.id, retryable: status >= 500 } });
  });
  await app.register(swagger, { openapi: { info: { title: '拾味本地开发 API', version: '0.1.0', description: '仅构造内容；真实账户、模型和健康支持尚未准入。' } } });
  app.get('/healthz', async () => ({ status: 'ok' }));
  const deployment = async () => options.database ? inspectDatabase(options.database, options.requireVector) : null;
  app.get('/deploymentz', async (_req, reply) => {
    const database = await deployment();
    const ready = database?.ready ?? (options.environment === undefined || options.environment === 'local');
    if (!ready) reply.code(503);
    return { status: ready ? 'structure_ready' : 'not_ready', database, releaseReady: false };
  });
  app.get('/readyz', async (_req, reply) => {
    const database = await deployment();
    const pending = options.contentSource === 'pending';
    let snapshot;
    try { snapshot = repository ? await repository.load(options.contentRelease!) : undefined; } catch { reply.code(503); }
    if (pending || (database && !database.ready) || (repository && !snapshot)) reply.code(503);
    return { status: pending ? 'content_pending' : (database && !database.ready) || (repository && !snapshot) ? 'not_ready' : options.environment==='preview'?'preview_ready':'local_only',
      contentVersion: pending || (repository && !snapshot) ? null : snapshot?.contentVersion ?? CONTENT_VERSION, localTestFeatures, database,
      gates: { content: false, model: false, cloud: false, accounts: false, health: false } };
  });
  app.get('/api/v1/auth/session', async (req, reply) => {
    const id = session(req.headers.cookie) ?? randomBytes(16).toString('hex');
    reply.header('Set-Cookie', `shiwei_guest=${id}.${sign(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${options.origin?.startsWith('https:') ? '; Secure' : ''}`);
    const loggedIn = Boolean(testSession(req.headers.cookie));
    const modelCapabilities = { imageRecognitionProvider:options.imageModel?.provider??"deepseek", erasureAvailable:Boolean(options.accounts?.erasureAvailable&&options.accounts.eraseAccount),recoveryAvailable:Boolean(options.accounts?.recoveryAvailable&&options.accounts.recoveryCode&&options.accounts.recoverPassword),healthChatAvailable, healthModelAvailable: Boolean(options.healthModel),...(options.foodGuidance?{healthGuidanceResearch:true}:{}),...(options.publishedKnowledge?{healthKnowledgeAvailable:true}:{}), ...(options.healthModel?.providerLabel ? { healthModelProvider: options.healthModel.providerLabel } : {}) };
    const account=await options.accounts?.authenticate(req.headers.cookie);
    if(account)return {...modelCapabilities,identity:'account',userId:account.userId,displayName:account.displayName,mustChangePassword:account.mustChangePassword,csrfToken:signCsrf(`csrf:${id}`),accountAvailable:true,registrationAvailable:registrationAvailable(),localTestFeatures:false,...((req.query as {state?:string}).state==='1'&&!account.mustChangePassword?{accountSnapshot:await options.accounts!.load(account)}:{})};
    return { ...modelCapabilities,identity: loggedIn ? 'local-test' : 'guest', ...(loggedIn ? { displayName: '本机测试账号' } : {}), csrfToken: signCsrf(`csrf:${id}`), accountAvailable: localTestFeatures||Boolean(options.accounts),registrationAvailable:registrationAvailable(), localTestFeatures };
  });
  app.get('/api/v1/catalog/recipes', async req => {
    const { contentVersion, recipes, foods, categories, relations, restrictionScope } = contextFor(req);
    // Keep editorial status, license checks, and review notes in the server-side
    // release. Product users see only usable public source attribution.
    return { contentVersion, recipes:recipes.map(publicRecipe), foods, categories, relations, restrictionScope };
  });
  app.get('/api/v1/local/candidate-recipes', async () => {
    if(['cloudbase','local-cache'].includes(options.contentSource??'')){
      const rows=await options.contentRepository!.candidates();
      return {recommendationAvailable:true,recipes:rows.map(publicRecipeRow)};
    }
    if (options.environment !== 'local' || !options.database) throw new DomainError('LOCAL_CANDIDATES_UNAVAILABLE',404,'本地候选菜谱只在连接本地数据库的开发环境开放');
    const rows = (await readCandidateRows(options.database)).map(row=>({...row,image_url:recipeImage(row.dish_key,row.image_url)??null}));
    return { recommendationAvailable:options.contentRelease === GALLERY_RELEASE,recipes:rows.map(publicRecipeRow) };
  });
  app.get('/api/v1/openapi.json', async () => app.swagger());
  app.post<{ Body: { text: string } }>('/api/v1/recognitions/text', { schema: { body: extractionSchema } }, async req => extractText(req.body.text,contextFor(req)));
  app.post<{Body:ImageRecognitionRequest}>('/api/v1/recognitions/image',{bodyLimit:2800000,schema:{body:imageRecognitionSchema}},async(req,reply)=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    const disconnect=()=>{if(!reply.raw.writableFinished)controller.abort();};reply.raw.once('close',disconnect);
    const signal=controller.signal;let reserved=false;
    try{
      const identity=await during(options.accounts?.authenticate(req.headers.cookie)??Promise.resolve(null),signal);
      if(!identity)throw new DomainError('LOGIN_REQUIRED',401,'请先登录，再识别图片中的食材');
      if(identity.mustChangePassword)throw new DomainError('PASSWORD_CHANGE_REQUIRED',403,'请先修改密码');
      validateImage(req.body.image);
      const config=options.imageModel??{provider:'deepseek' as const};
      const stored=config.provider==='deepseek'?await during(options.accounts!.healthKey?.(identity)??Promise.resolve(null),signal):null;
      const apiKey=config.provider==='zhipu'?config.apiKey:stored?.apiKey;
      if(!apiKey)throw new DomainError('CHAT_KEY_REQUIRED',400,'请先在个人设置中保存 DeepSeek API Key，再识别食材图片');
      if(chatsInFlight>=4)throw new DomainError('CHAT_BUSY',429,'AI 使用人数较多，请稍后再试');
      chatsInFlight++;reserved=true;
      if(!options.accounts?.claimAiChat)throw new DomainError('CHAT_NOT_READY',503,'图片识别暂不可用');
      const fingerprint=createHmac('sha256',secret).update('ingredient-image-v1\0').update(req.body.image).update(config.provider).update(apiKey).digest('hex');
      const claim=await during(options.accounts.claimAiChat(identity,req.body.operationId,fingerprint),signal);
      if(!claim.claimed)throw new DomainError(claim.reason==='duplicate'?'CHAT_OPERATION_USED':'CHAT_RATE_LIMIT',claim.reason==='duplicate'?409:429,claim.reason==='duplicate'?'这张图片已提交，未自动重发':'识别较频繁，请稍后再试');
      const assertCurrent=async()=>{
        const active=await during(options.accounts!.authenticate(req.headers.cookie),signal);
        if(!active||active.userId!==identity.userId)throw new DomainError('LOGIN_REQUIRED',401,'登录已失效，请重新登录');
        if(active.mustChangePassword)throw new DomainError('PASSWORD_CHANGE_REQUIRED',403,'请先修改密码');
        if(config.provider==='deepseek'){
          const current=await during(options.accounts!.healthKey?.(active)??Promise.resolve(null),signal);
          if(current?.apiKey!==apiKey)throw new DomainError('CHAT_KEY_CHANGED',409,'Key 已变更，请重新识别');
        }
        signal.throwIfAborted();
      };
      // Claiming can wait on another transaction. Recheck revocations before uploading any pixels.
      await assertCurrent();
      const result=await during(recognizeImage(req.body.image,req.body.operationId,config,apiKey,contextFor(req),signal,options.imageRecognitionFetch),signal);
      await assertCurrent();
      return result;
    }finally{clearTimeout(timer);reply.raw.off('close',disconnect);if(reserved)chatsInFlight--;}
  });
  const requireRegistration=()=>{if(!registrationAvailable())throw new DomainError('REGISTRATION_UNAVAILABLE',503,'注册暂不可用，请稍后重试');return options.accounts!;};
  app.post('/api/v1/auth/registration/captcha',{schema:{body:{type:'object',additionalProperties:false,maxProperties:0}}},async req=>{
    if(!options.accounts?.captcha)throw new DomainError('ACCOUNT_UNAVAILABLE',503,'图片验证暂不可用，请稍后重试');
    return options.accounts.captcha(session(req.headers.cookie)!);
  });
  app.post<{Body:{email:string;captcha?:{challenge:string;key:string}}}>('/api/v1/auth/registration/code',{schema:{body:{type:'object',additionalProperties:false,required:['email'],properties:{email:{type:'string',maxLength:254},captcha:{type:'object',additionalProperties:false,required:['challenge','key'],properties:{challenge:{type:'string',minLength:1,maxLength:6000},key:{type:'string',minLength:1,maxLength:16}}}}}}},async(req,reply)=>{
    const accounts=requireRegistration(),subject=session(req.headers.cookie)!;
    const email=req.body.email.trim().toLowerCase();
    if(!validEmail(email))throw new DomainError('INVALID_EMAIL',400,'请输入有效的邮箱地址');
    if(registrationSends.has(subject)&&Date.now()-registrationSends.get(subject)!<60000){reply.header('Retry-After','60');throw new DomainError('VERIFICATION_RATE_LIMIT',429,'请60秒后再获取验证码');}
    if(registrationSends.size>=2000&&!registrationSends.has(subject))throw new DomainError('REGISTRATION_BUSY',503,'注册人数较多，请稍后再试');
    const started=Date.now();registrationSends.set(subject,started);
    try{return await accounts.registrationCode!(email,subject,req.body.captcha);}
    catch(error){if(registrationSends.get(subject)===started)registrationSends.delete(subject);throw error;}
  });
  app.post<{Body:RegistrationInput}>('/api/v1/auth/register',{schema:{body:{type:'object',additionalProperties:false,required:['username','password','code','challenge'],properties:{username:{type:'string',minLength:5,maxLength:24},password:{type:'string',minLength:8,maxLength:32},code:{type:'string',pattern:'^[0-9]{6}$'},challenge:{type:'string',minLength:1,maxLength:6000}}}}},async(req,reply)=>{
    const accounts=requireRegistration(),identity=await accounts.register!(req.body,session(req.headers.cookie)!);
    reply.header('Set-Cookie',accounts.cookie(identity));return {identity:'account',displayName:identity.displayName};
  });
  const recoveryAccounts=()=>{if(!options.accounts?.recoveryAvailable||!options.accounts.recoveryCode||!options.accounts.recoverPassword)throw new DomainError('RECOVERY_UNAVAILABLE',503,'找回密码暂不可用');return options.accounts;};
  app.post<{Body:{email:string;captcha?:{challenge:string;key:string}}}>('/api/v1/auth/recovery/code',{schema:{body:{type:'object',additionalProperties:false,required:['email'],properties:{email:{type:'string',minLength:3,maxLength:254},captcha:{type:'object',additionalProperties:false,required:['challenge','key'],properties:{challenge:{type:'string',minLength:1,maxLength:6000},key:{type:'string',minLength:1,maxLength:16}}}}}}},async(req,reply)=>{
    const accounts=recoveryAccounts(),subject=session(req.headers.cookie)!,key=`recovery:${subject}`;
    if(registrationSends.has(key)&&Date.now()-registrationSends.get(key)!<60000){reply.header('Retry-After','60');throw new DomainError('VERIFICATION_RATE_LIMIT',429,'请60秒后再获取验证码');}
    if(registrationSends.size>=2000&&!registrationSends.has(key))throw new DomainError('RECOVERY_UNAVAILABLE',503,'验证服务繁忙，请稍后重试');
    const started=Date.now();registrationSends.set(key,started);
    try{return await accounts.recoveryCode!(req.body.email.trim().toLowerCase(),subject,req.body.captcha);}catch(error){if(registrationSends.get(key)===started)registrationSends.delete(key);throw error;}
  });
  app.post<{Body:{challenge:string;code:string;newPassword:string}}>('/api/v1/auth/recovery/complete',{schema:{body:{type:'object',additionalProperties:false,required:['challenge','code','newPassword'],properties:{challenge:{type:'string',minLength:1,maxLength:6000},code:{type:'string',pattern:'^[0-9]{6}$'},newPassword:{type:'string',minLength:8,maxLength:32}}}}},async(req,reply)=>{
    const accounts=recoveryAccounts();await accounts.recoverPassword!(req.body,session(req.headers.cookie)!);
    reply.header('Set-Cookie',accounts.cookie(null));return {changed:true,loginRequired:true};
  });
  app.post<{ Body: { mode?: 'local-test';username?:string;password?:string;captcha?:{challenge:string;key:string} } }>('/api/v1/auth/login', async (req, reply) => {
    if(options.accounts){
      const {username,password,captcha,...rest}=req.body??{};
      if(typeof username!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,47}$/.test(username)||typeof password!=='string'||password.length<8||password.length>64||Object.keys(rest).length)throw new DomainError('INVALID_LOGIN',400,'请输入用户名和密码');
      if(captcha!==undefined&&(!captcha||typeof captcha!=='object'||Array.isArray(captcha)||!captcha.challenge||typeof captcha.challenge!=='string'||captcha.challenge.length>6000||typeof captcha.key!=='string'||!captcha.key||captcha.key.length>16||Object.keys(captcha).some(key=>!['challenge','key'].includes(key))))throw new DomainError('INVALID_CAPTCHA',400,'请填写图片验证码');
      const identity=await options.accounts.login(username,password,{subject:session(req.headers.cookie)!,captcha});
      reply.header('Set-Cookie',options.accounts.cookie(identity));
      return {identity:'account',displayName:identity.displayName};
    }
    if (!localTestFeatures) throw new DomainError('AUTH_NOT_ADMITTED', 503, '账户服务暂不可用，本机收藏和常用偏好可继续使用');
    if (!req.body || req.body.mode !== 'local-test' || Object.keys(req.body).length !== 1) throw new DomainError('INVALID_LOGIN', 400, '请选择本机测试登录');
    if (testSessions.size >= 1000) throw new DomainError('TEST_SESSION_LIMIT', 503, '测试会话已满，请稍后重试');
    const old = testSession(req.headers.cookie); if (old) testSessions.delete(old);
    const token = randomBytes(32).toString('base64url');
    testSessions.set(token, { guest: session(req.headers.cookie)!, expires: Date.now() + 30 * 60_000 });
    reply.header('Set-Cookie', testCookie(token, 1800));
    return { identity: 'local-test', displayName: '本机测试账号' };
  });
  app.post('/api/v1/auth/logout', async (req, reply) => {
    if(options.accounts){
      const identity=await options.accounts.authenticate(req.headers.cookie);
      if(identity)await options.accounts.logout(identity);
      reply.header('Set-Cookie',options.accounts.cookie(null));
      return {identity:'guest'};
    }
    const token = testSession(req.headers.cookie); if (token) testSessions.delete(token);
    reply.header('Set-Cookie', testCookie('', 0));
    return { identity: 'guest' };
  });
  const requireAccount=async(req:FastifyRequest)=>{
    const identity=await options.accounts?.authenticate(req.headers.cookie);
    if(!identity)throw new DomainError('LOGIN_REQUIRED',401,'请先登录，收藏和偏好会保留在当前设备');
    return identity;
  };
  app.post<{Body:HealthChatRequest}>('/api/v1/health/chat',{schema:{body:healthChatSchema}},async(req,reply)=>{
    if(!healthChatAvailable)throw new DomainError('CHAT_NOT_READY',503,'AI 对话暂时无法连接，请稍后再试');
    const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(17000)]);
    const onClose=()=>{if(!reply.raw.writableEnded)controller.abort();};reply.raw.on('close',onClose);
    let reserved=false;
    try{
      const identity=await during(options.accounts?.authenticate(req.headers.cookie)??Promise.resolve(null),signal);
      if(!identity&&!testSession(req.headers.cookie))throw new DomainError('LOGIN_REQUIRED',401,'请先登录，再使用健康AI对话');
      if(identity?.mustChangePassword)throw new DomainError('PASSWORD_CHANGE_REQUIRED',403,'请先修改密码');
      assertChat(req.body);
      const stored=identity?await during(options.accounts!.healthKey?.(identity)??Promise.resolve(null),signal):null;
      const apiKey=identity?stored?.apiKey:req.body.apiKey;
      if(!apiKey&&!options.foodGuidance)throw new DomainError('CHAT_KEY_REQUIRED',400,'请先在个人设置中保存 DeepSeek API Key');
      if(chatsInFlight>=4)throw new DomainError('CHAT_BUSY',429,'AI 对话人数较多，请稍后再试');
      chatsInFlight++;reserved=true;
      const fingerprint=createHmac('sha256',secret).update('health-chat-v1\0').update(JSON.stringify(req.body)).update(apiKey??'local-research-no-model').digest('hex');
      if(identity&&!options.foodGuidance){
        if(!options.accounts?.claimAiChat)throw new DomainError('CHAT_NOT_READY',503,'AI 对话暂时无法连接，请稍后再试');
        const claim=await during(options.accounts.claimAiChat(identity,req.body.operationId,fingerprint),signal);
        if(!claim.claimed)throw new DomainError(claim.reason==='duplicate'?'CHAT_OPERATION_USED':'CHAT_RATE_LIMIT',claim.reason==='duplicate'?409:429,claim.reason==='duplicate'?'这条消息已提交，请等待结果；未自动重发':'发送较频繁，请稍后再试');
      }else if(!identity){
        // Explicit loopback test identity only. Public accounts always use shared PG claims.
        const prefix=`${session(req.headers.cookie)}:`,key=prefix+req.body.operationId;
        if(localChatClaims.has(key))throw new DomainError('CHAT_OPERATION_USED',409,'这条消息已提交，请等待结果；未自动重发');
        if([...localChatClaims].filter(([id,at])=>id.startsWith(prefix)&&at>Date.now()-60000).length>=6)throw new DomainError('CHAT_RATE_LIMIT',429,'发送较频繁，请稍后再试');
        if(localChatClaims.size>=3000)throw new DomainError('CHAT_BUSY',429,'本机测试对话已满，请稍后再试');
        localChatClaims.set(key,Date.now());
      }
      const chatContext=repository?contentContext(await during(repository.load(options.contentRelease!),signal)):constructedContent;
      if(identity){
        const active=await during(options.accounts!.authenticate(req.headers.cookie),signal);
        if(!active||active.userId!==identity.userId||active.mustChangePassword)throw new DomainError('LOGIN_REQUIRED',401,'登录已失效，请重新登录');
        const current=await during(options.accounts!.healthKey!(active),signal);
        if(current.apiKey!==apiKey)throw new DomainError('CHAT_KEY_CHANGED',409,'Key 已更新，请重新发送');
        if(JSON.stringify(current.restrictions)!==JSON.stringify(stored?.restrictions??[]))throw new DomainError('CHAT_RESTRICTIONS_CHANGED',409,'饮食限制已更新，请按最新设置继续');
      }
      const currentProfile=identity?stored?.profile:req.body.profile;
      const contextValue=(profile:HealthChatRequest['profile'])=>profile?{conditions:profile.conditions,goals:profile.goals,notes:profile.notes}:{conditions:[],goals:[],notes:''};
      const label=(r:import('../../shared/types').Restriction)=>`${r.kind==='allergy'?'过敏':r.kind==='avoid'?'忌口':'待确认'}：${r.name}`;
      const currentRestrictions=identity?(stored?.restrictions??[]).filter(r=>r.scope==='self'||req.body.mealContext?.restrictions.includes(label(r))).map(label):req.body.mealContext?.restrictions??[];
      const restrictionKey=(items:string[])=>JSON.stringify([...items].sort());
      const staleRestrictions=identity&&restrictionKey(req.body.mealContext?.restrictions??[])!==restrictionKey(currentRestrictions);
      const messages=identity&&(staleRestrictions||JSON.stringify(contextValue(req.body.profile))!==JSON.stringify(contextValue(currentProfile)))?req.body.messages.slice(-1):req.body.messages;
      const chatBody={...req.body,messages,apiKey,diseases:identity?stored?.profile?.conditions??[]:req.body.diseases,profile:contextValue(currentProfile),mealContext:{ingredients:[],seasonings:[],allowBuy:false,...req.body.mealContext,restrictions:currentRestrictions,aiFoodPreferences:identity?stored?.preferences:req.body.mealContext?.aiFoodPreferences}};
      const sourcePacket=options.publishedKnowledge?await during(options.publishedKnowledge.prepare({profile:chatBody.profile,content:chatContext,currentText:messages.at(-1)!.content}),signal):undefined;
      const result=await during(options.foodGuidance?researchFoodChat(chatBody,chatContext,options.foodGuidance):requestHealthChat(chatBody,signal,options.healthChatFetch,name=>chatContext.restrictionTargets(name).length>0,healthTopics(stored?.profile,stored?.preferences),sourcePacket),signal);
      if(sourcePacket){
        await during(options.publishedKnowledge!.assertCurrent(sourcePacket),signal);
        if(result.assessment){result.assessment.suggestions=balancedFoodSuggestions(sourcePacket,chatContext,[]);if(result.assessment.suggestions.length)result.assessment.stage='advice';}
        const titles=[...new Set(sourcePacket.evidence.map(e=>e.title))].slice(0,3);
        if(titles.length)result.message.content+='\n依据：'+titles.join('；')+'。';
      }
      if(identity){
        const active=await during(options.accounts!.authenticate(req.headers.cookie),signal);
        if(!active||active.userId!==identity.userId||active.mustChangePassword)throw new DomainError('LOGIN_REQUIRED',401,'登录已失效，请重新登录');
        const current=await during(options.accounts!.healthKey!(active),signal);
        if(JSON.stringify(current.restrictions)!==JSON.stringify(stored?.restrictions??[]))throw new DomainError('CHAT_RESTRICTIONS_CHANGED',409,'饮食限制已更新，本次旧回复未采用，请按最新设置继续');
      }
      if(result.assessment){
        const restrictionNames=currentRestrictions.map(name=>name.replace(/^(过敏|忌口|待确认)：/,''));
        result.assessment.suggestions=withoutExistingRestrictions(expandFoodSuggestions(result.assessment.suggestions,chatContext),restrictionNames,chatContext);
        result.message.content=withoutRepeatedFoodText(result.message.content,restrictionNames,chatContext);
        result.assessment.recipes=healthChatRecipes(chatContext,result.assessment,{ingredients:[],seasonings:[],allowBuy:false,...req.body.mealContext,restrictions:restrictionNames});
        if(identity&&options.accounts?.saveHealthGuidance){
          const previous=stored?.profile?{...stored.profile,topics:healthTopics(stored.profile,stored.preferences)}:undefined;
          const profile=mergeHealthProfile(previous,result.assessment);
          profile.suggestions=withoutExistingRestrictions(profile.suggestions,restrictionNames,chatContext);
          try{result.accountSnapshot=await during(options.accounts.saveHealthGuidance(identity,profile,apiKey??'',stored?.profile,stored?.restrictions),signal);}
          catch(error){if(error instanceof DomainError&&['CHAT_KEY_CHANGED','CHAT_PROFILE_CHANGED','CHAT_RESTRICTIONS_CHANGED'].includes(error.code))throw error;result.saveError='本次建议暂未保存到账户，可稍后查看个人设置。';}
        }
      }
      const active=identity?await during(options.accounts!.authenticate(req.headers.cookie),signal):testSession(req.headers.cookie);
      if(!active||(identity&&(typeof active!=='object'||active.userId!==identity.userId||active.mustChangePassword)))throw new DomainError('LOGIN_REQUIRED',401,'登录已失效，请重新登录');
      if(result.researchGuidance)await (options.foodGuidance??options.publishedKnowledge)!.assertCurrent(result.researchGuidance);
      return result;
    }finally{if(reserved)chatsInFlight--;reply.raw.removeListener('close',onClose);}
  });
  app.post<{Body:{expectedVersion:number;apiKey:string|null}}>('/api/v1/account/health-key',{schema:{body:{type:'object',additionalProperties:false,required:['expectedVersion','apiKey'],properties:{expectedVersion:{type:'integer',minimum:0,maximum:2147483647},apiKey:{anyOf:[{type:'string',pattern:'^sk-[A-Za-z0-9_-]{16,250}$'},{type:'null'}]}}}}},async req=>{
    const identity=await requireAccount(req);
    if(!options.accounts?.setHealthKey)throw new DomainError('CHAT_NOT_READY',503,'Key 设置暂不可用，请稍后重试');
    return options.accounts.setHealthKey(identity,req.body.expectedVersion,req.body.apiKey);
  });
  app.get('/api/v1/account/state',async req=>{const identity=await requireAccount(req);return options.accounts!.load(identity);});
  app.post<{Body:{expectedVersion:number;value:AccountValue}}>('/api/v1/account/state',{schema:{body:{type:'object',additionalProperties:false,required:['expectedVersion','value'],properties:{
    expectedVersion:{type:'integer',minimum:0,maximum:2147483647},
    value:{type:'object',additionalProperties:false,required:['favorites','defaults'],properties:{
      favorites:{type:'array',maxItems:100,items:{type:'object',required:['recipeId','variantId'],additionalProperties:false,properties:{recipeId:{type:'string',minLength:1,maxLength:80},variantId:{type:'string',minLength:1,maxLength:100}}}},
      defaults:{anyOf:[personalSettingsSchema,mealSchema,{type:'null'}]},
    }},
  }}}},async req=>{
    const identity=await requireAccount(req);
    const defaults=req.body.value.defaults;
    if(defaults&&(defaults.ingredients?.length||defaults.raw||Object.keys(defaults.overrides??{}).length||defaults.includeAdditional))throw new DomainError('INVALID_DEFAULTS',400,'本餐食材和文字不会保存到账户');
    return options.accounts!.save(identity,req.body.expectedVersion,{...req.body.value,defaults:defaults?personalSettings(defaults):null});
  });
  app.post<{Body:{oldPassword:string;newPassword:string}}>('/api/v1/account/password',{schema:{body:{type:'object',additionalProperties:false,required:['oldPassword','newPassword'],properties:{oldPassword:{type:'string',minLength:8,maxLength:64},newPassword:{type:'string',minLength:8,maxLength:32}}}}},async(req,reply)=>{
    if(!validNewPassword(req.body.newPassword)||req.body.newPassword===req.body.oldPassword)throw new DomainError('WEAK_PASSWORD',400,'新密码请使用8～32位大小写字母、数字和符号的组合，且不能与旧密码相同');
    const identity=await requireAccount(req);
    await options.accounts!.changePassword(identity,req.body.oldPassword,req.body.newPassword);
    await options.accounts!.logout(identity);
    reply.header('Set-Cookie',options.accounts!.cookie(null));
    return {changed:true,loginRequired:true};
  });
  app.post<{Body:{password:string;confirmation:string}}>('/api/v1/account/erasure',{schema:{body:{type:'object',additionalProperties:false,required:['password','confirmation'],properties:{password:{type:'string',minLength:8,maxLength:64},confirmation:{const:'注销账号'}}}}},async(req,reply)=>{
    if(!options.accounts?.erasureAvailable||!options.accounts.eraseAccount)throw new DomainError('ERASURE_UNAVAILABLE',503,'账号注销暂不可用');
    const identity=await requireAccount(req),result=await options.accounts.eraseAccount(identity,req.body.password);
    reply.header('Set-Cookie',options.accounts.cookie(null));return result;
  });
  app.post<{ Body: RecommendationRequest }>('/api/v1/recommendations', { schema: { body: recommendationSchema } }, async (req, reply) => {
    req.body={...req.body,meal:recommendationMeal(req.body.meal)};
    const budget=AbortSignal.timeout(17000);
    const subject = session(req.headers.cookie)!;
    const context = contextFor(req);
    const modelHealth = req.body.meal.health && Boolean(options.healthModel) && !options.accounts?.claimAiChat;
    const chatHealth = req.body.meal.health && healthChatAvailable && !modelHealth;
    const modelIdentity = modelHealth || chatHealth ? await during(options.accounts?.authenticate(req.headers.cookie)??Promise.resolve(undefined),budget) : undefined;
    const taskKey=`${subject}:${modelIdentity?.userId??'local'}:${req.body.taskId??'legacy'}`;
    const current = latest.get(taskKey);
    if (current && req.body.meal.version < current.version) throw new DomainError('STALE_MEAL', 409, '本餐已有新版本，请按当前条件重新生成');
    if(latest.size>=4000&&!latest.has(taskKey))throw new DomainError('TASK_BUSY',429,'当前任务较多，请稍后重试');
    latest.set(taskKey, { version: req.body.meal.version, operation: req.body.operationId, touched: Date.now() });
    if ((modelHealth || chatHealth) && !modelIdentity && !testSession(req.headers.cookie)) throw new DomainError('LOGIN_REQUIRED', 401, '请先登录，再开启健康模式');
    if (modelIdentity?.mustChangePassword) throw new DomainError('PASSWORD_CHANGE_REQUIRED',403,'请先修改密码');
    const localHealthTest = req.body.meal.health && localTestFeatures && !modelHealth && !chatHealth;
    if (localHealthTest && !testSession(req.headers.cookie)) throw new DomainError('LOGIN_REQUIRED', 401, '请先登录，再开启健康模式测试');
    const stored=chatHealth&&modelIdentity?await during(options.accounts!.healthKey?.(modelIdentity)??Promise.resolve(undefined),budget):undefined;
    if(chatHealth&&modelIdentity){
      if(!stored?.apiKey)throw new DomainError('CHAT_KEY_REQUIRED',400,'请先在个人设置中保存 DeepSeek Key，再请 AI 搭配菜品');
      req.body.meal={...req.body.meal,healthProfile:stored.profile,aiFoodPreferences:stored.preferences,aiExcludedFoods:stored.exclusions??[],restrictions:[...new Map([...(stored.restrictions??[]),...req.body.meal.restrictions].map(item=>[JSON.stringify([item.kind,item.name,item.scope]),item])).values()]};
    }
    assertMeal(req.body.meal,context);
    const sharedTask=Boolean(options.sharedRecommendationTasks&&chatHealth&&modelIdentity);
    if(sharedTask){
      if(!req.body.taskId||!options.accounts?.advanceRecommendationTask||!options.accounts.recommendationTaskCurrent)throw new DomainError('TASK_STATE_UNAVAILABLE',503,'任务状态尚未准备好，请保留本餐输入');
      if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(req.body.operationId))throw new DomainError('INVALID_OPERATION',400,'请重新发起本次 AI 搭配');
      const state=await during(options.accounts.advanceRecommendationTask(modelIdentity!,req.body.taskId,req.body.meal.version,req.body.operationId),budget);
      if(!state.accepted)throw new DomainError(state.reason==='stale'?'STALE_MEAL':'TASK_BUSY',state.reason==='stale'?409:429,state.reason==='stale'?'本餐已有新版本，请按当前条件重新生成':'当前任务较多，请稍后重试');
    }
    const controller = new AbortController();
    const signal=AbortSignal.any([controller.signal,budget]);
    let recipeReserved=false;
    const onClose = () => { if (!reply.raw.writableEnded) controller.abort(); };
    reply.raw.on('close', onClose);
    const stream = req.headers.accept === 'application/x-ndjson';
    if (stream) {
      reply.hijack();
      reply.raw.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      reply.raw.write(JSON.stringify({ type: 'progress', stage: '输入格式已校验，正在核对目录与库存' }) + '\n');
    }
    try {
      let result = chatHealth&&modelIdentity&&stored?await during(selectHealthRecipes({request:req.body,owner:modelIdentity.userId,apiKey:stored.apiKey,context,signal,fetcher:options.healthRecipeFetch??options.healthChatFetch,present:publicDish,observe:options.healthRecipeObserve,
        progress:text=>{if(stream&&!reply.raw.destroyed)reply.raw.write(JSON.stringify({type:'progress',stage:text})+'\n');},
        claim:async()=>{
          if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(req.body.operationId))throw new DomainError('INVALID_OPERATION',400,'请重新发起本次 AI 搭配');
          if(chatsInFlight>=4)throw new DomainError('CHAT_BUSY',429,'AI 正在处理较多请求，请稍后主动重试');
          chatsInFlight++;recipeReserved=true;
          const fingerprint=createHmac('sha256',secret).update('ai-recipe-selection-v1').update(JSON.stringify(req.body)).update(stored.apiKey).digest('hex');
          const claim=await during(options.accounts!.claimAiChat!(modelIdentity,req.body.operationId,fingerprint),signal);
          if(!claim.claimed)throw new DomainError(claim.reason==='duplicate'?'CHAT_OPERATION_USED':'CHAT_RATE_LIMIT',claim.reason==='duplicate'?409:429,claim.reason==='duplicate'?'这次 AI 搭配已提交，未重复调用模型':'发送较频繁，请稍后主动重试');
        }
      }),signal):await recommend(context.recipes,req.body,{signal:controller.signal,localHealthTest,conversationOnly:chatHealth,context,cursorSecret:recommendationCursorSecret});
      if(chatHealth&&!modelIdentity)result={...result,healthAssessment:{state:'test_only',message:'本机测试的食材筛选结果，不代表真实 AI 选菜。'}};
      if(chatHealth&&modelIdentity){
        const active=await during(options.accounts!.authenticate(req.headers.cookie),signal);
        if(!active||active.userId!==modelIdentity.userId||active.mustChangePassword)throw new DomainError('LOGIN_REQUIRED',401,'登录已失效，请重新登录');
        const current=await during(options.accounts!.healthKey!(active),signal);
        if(JSON.stringify(current)!==JSON.stringify(stored))throw new DomainError('CHAT_PROFILE_CHANGED',409,'健康档案或食材选择已改变，请按当前条件重新搭配；本次未覆盖新设置');
      }
      if (modelHealth && result.status === 'unavailable' && !controller.signal.aborted) {
        if (stream && !reply.raw.destroyed) reply.raw.write(JSON.stringify({ type: 'progress', stage: '正在整理疾病信息与证据检索词' }) + '\n');
        const healthAssessment = await options.healthModel!.prepare({ subject: modelIdentity ? `account:${modelIdentity.userId}` : `guest:${subject}`,
          operationId: req.body.operationId, mealVersion: req.body.meal.version, diseases: req.body.meal.diseases, signal: controller.signal });
        result = { ...result, healthAssessment, reasons: [healthAssessment.message] };
        const stillLoggedIn = modelIdentity ? await options.accounts!.authenticate(req.headers.cookie) : testSession(req.headers.cookie);
        if (!stillLoggedIn || (modelIdentity && (typeof stillLoggedIn !== 'object' || stillLoggedIn.userId !== modelIdentity.userId || stillLoggedIn.mustChangePassword))) {
          throw new DomainError('LOGIN_REQUIRED', 401, '登录已失效，请重新登录后再试');
        }
      }
      if (repository && (await repository.load(options.contentRelease!)).contentVersion !== context.contentVersion) throw new DomainError('CONTENT_CHANGED',409,'菜谱已变化，请重新搭配');
      if ((localHealthTest || (chatHealth&&!modelIdentity)) && !testSession(req.headers.cookie)) result = { ...result, dishes: [], checks: [], status: 'cancelled', reasons: ['登录已失效，请重新登录后再试'] };
      const newest = latest.get(taskKey);
      const sharedCurrent=!sharedTask||await during(options.accounts!.recommendationTaskCurrent!(modelIdentity!,req.body.taskId!,req.body.meal.version,req.body.operationId),signal);
      if (!sharedCurrent||newest?.operation !== req.body.operationId || newest?.version !== req.body.meal.version) result = { ...result, healthAssessment: undefined,selectionScope:undefined,cursor:'',dishes: [], checks: [], status: 'cancelled', reasons: ['旧操作已被新条件取代'] };
      const publicResult={...result,dishes:result.dishes.map(publicDish)};
      if(result.researchGuidance)await (options.foodGuidance??options.publishedKnowledge)!.assertCurrent(result.researchGuidance);
      if (stream) { if (!reply.raw.destroyed) reply.raw.end(JSON.stringify({ type: 'result', result:publicResult }) + '\n'); return; }
      return publicResult;
    } catch (e) {
      if (stream) { if (!reply.raw.destroyed) reply.raw.end(JSON.stringify({ type: 'error', code: e instanceof DomainError ? e.code : 'RECOMMENDATION_FAILED', message: e instanceof DomainError?e.message:'本次计算中断，请主动重试；原输入已保留', retryable: true, requestId: req.id }) + '\n'); return; }
      throw e;
    } finally { if(recipeReserved)chatsInFlight--;reply.raw.removeListener('close', onClose); }
  });
  const root = options.staticRoot ?? resolve('artifacts/build/web');
  if (existsSync(root)) {
    await app.register(fastifyStatic, { root, prefix: '/', index: 'index.html' });
    app.get('/recipes', async (_req, reply) => reply.sendFile('index.html'));
    app.get('/favorites', async (_req, reply) => reply.sendFile('index.html'));
  }
  return app;
}
