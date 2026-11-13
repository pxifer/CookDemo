import {createCloudKnowledge} from '../../backend/src/rag/cloud-knowledge';
import {readImageModelConfig} from '../../backend/src/image-recognition';
import { createApp } from '../../backend/src/app';
import { CloudBaseGalleryRepository } from '../../backend/src/cloudbase-content';
import { GALLERY_RELEASE } from '../../backend/src/gallery-content';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { CloudBaseAccounts } from '../../backend/src/cloudbase-accounts';
import { cloudTarget } from '../../backend/src/cloud-target';
import { stagingAccounts } from '../../backend/src/staging-accounts';
import { constructedContent } from '../../shared/catalog';

export async function startHttpFunction(env=process.env) {
  const target=cloudTarget(env),origin=target.origin;
  if(process.versions.node.split('.')[0]!=='24')throw new Error('HTTP_FUNCTION_CONFIGURATION');
  const key=(name:string)=>{const value=env[name]??'',bytes=Buffer.from(value,'base64');if(bytes.length!==32||bytes.toString('base64')!==value)throw new Error('HTTP_FUNCTION_SESSION_CONFIGURATION');return bytes;};
  const sessionSecret=key('SESSION_SECRET_B64'),csrfSecret=key('CSRF_SECRET_B64');
  if(sessionSecret.equals(csrfSecret)||env.LOCAL_TEST_FEATURES==='1')throw new Error('HTTP_FUNCTION_SESSION_CONFIGURATION');
  const contentRepository=new CloudBaseGalleryRepository({envId:target.envId,publishableKey:env.CLOUDBASE_PUBLISHABLE_KEY??'',releaseId:env.CONTENT_BUNDLE_ID??'',hash:env.CONTENT_BUNDLE_SHA256??'',compositionReleaseId:env.COMPOSITION_RELEASE_ID,compositionHash:env.COMPOSITION_RELEASE_SHA256});
  const profileKey=env.ACCOUNT_SYNC_ENABLED==='1'?key('PROFILE_ENCRYPTION_KEY_B64'):undefined;
  if(profileKey&&(profileKey.equals(sessionSecret)||profileKey.equals(csrfSecret)))throw new Error('ACCOUNT_ENCRYPTION_CONFIGURATION');
  const baseAccounts=profileKey?new CloudBaseAccounts({envId:target.envId,allowedEnvIds:target.stage==='staging'?[target.envId]:undefined,cookieKey:createHmac('sha256',sessionSecret).update('account-cookie-v1').digest(),profileKey,keyVersion:env.PROFILE_KEY_VERSION??'profile-20261024-v1',registrationEnabled:env.PUBLIC_REGISTRATION_ENABLED==='1',recoveryEnabled:env.PASSWORD_RECOVERY_ENABLED==='1',recoveryAllowedEmails:target.stage==='staging'?target.testRecoveryEmails:undefined}):undefined;
  const accounts=baseAccounts&&target.stage==='staging'?stagingAccounts(baseAccounts,target.testUsers,{passwordRecoveryEnabled:target.testRecoveryEmails.length>0}):baseAccounts;
  const publishedKnowledge=env.KNOWLEDGE_RELEASE_ID?createCloudKnowledge({envId:target.envId,key:env.CLOUDBASE_PUBLISHABLE_KEY??'',releaseId:env.KNOWLEDGE_RELEASE_ID,hash:env.KNOWLEDGE_RELEASE_SHA256??''}):undefined;
  const app=await createApp({publishedKnowledge,imageModel:readImageModelConfig(env),environment:'preview',origin,sessionSecret,csrfSecret,contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,contentRepository,accounts,sharedRecommendationTasks:env.RECOMMENDATION_TASKS_ENABLED==='1',staticRoot:resolve(env.STATIC_ROOT??'build/web')});
  // Keep static bytes on the environment's existing free static hosting.
  app.get('/assets/recipes/*',async(req,reply)=>{
    if(!/^\/assets\/recipes\/[a-zA-Z0-9_.-]+\.(?:png|webp)$/.test(req.url.split('?')[0]))return reply.code(404).send();
    return reply.redirect(`https://shiwei-d2gmiun66b7dc6a4f-1512010497.tcloudbaseapp.com${req.url.split('?')[0]}`);
  });
  await app.listen({host:'0.0.0.0',port:9000});
  // Warm the immutable knowledge release while the instance is idle, so the first health AI
  // request does not pay the ~1s payload download/validation on top of the model call.
  if(publishedKnowledge)void publishedKnowledge.prepare({profile:{conditions:[],goals:[],notes:''},content:constructedContent}).catch(()=>{});
  for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>void app.close());
  return app;
}
startHttpFunction().catch(error=>{console.error('HTTP_FUNCTION_START_FAILED',typeof error?.code==='string'?error.code:error?.name??'Error');process.exitCode=1;});
