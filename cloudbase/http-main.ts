import { createApp } from '../server/app';
import { CloudBaseGalleryRepository } from '../server/cloudbase-content';
import { GALLERY_RELEASE } from '../server/gallery-content';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { CloudBaseAccounts } from '../server/cloudbase-accounts';

export async function startHttpFunction(env=process.env) {
  const origin=env.APP_ORIGIN;
  if(process.versions.node.split('.')[0]!=='24'||!origin||new URL(origin).origin!==origin||!origin.startsWith('https://')||env.CLOUDBASE_ENV_ID!=='shiwei-d2gmiun66b7dc6a4f')throw new Error('HTTP_FUNCTION_CONFIGURATION');
  const key=(name:string)=>{const value=env[name]??'',bytes=Buffer.from(value,'base64');if(bytes.length!==32||bytes.toString('base64')!==value)throw new Error('HTTP_FUNCTION_SESSION_CONFIGURATION');return bytes;};
  const sessionSecret=key('SESSION_SECRET_B64'),csrfSecret=key('CSRF_SECRET_B64');
  if(sessionSecret.equals(csrfSecret)||env.LOCAL_TEST_FEATURES==='1')throw new Error('HTTP_FUNCTION_SESSION_CONFIGURATION');
  const contentRepository=new CloudBaseGalleryRepository({envId:env.CLOUDBASE_ENV_ID,publishableKey:env.CLOUDBASE_PUBLISHABLE_KEY??'',releaseId:env.CONTENT_BUNDLE_ID??'',hash:env.CONTENT_BUNDLE_SHA256??'',compositionReleaseId:env.COMPOSITION_RELEASE_ID,compositionHash:env.COMPOSITION_RELEASE_SHA256});
  const profileKey=env.ACCOUNT_SYNC_ENABLED==='1'?key('PROFILE_ENCRYPTION_KEY_B64'):undefined;
  if(profileKey&&(profileKey.equals(sessionSecret)||profileKey.equals(csrfSecret)))throw new Error('ACCOUNT_ENCRYPTION_CONFIGURATION');
  const accounts=profileKey?new CloudBaseAccounts({envId:env.CLOUDBASE_ENV_ID,cookieKey:createHmac('sha256',sessionSecret).update('account-cookie-v1').digest(),profileKey,keyVersion:env.PROFILE_KEY_VERSION??'profile-20261024-v1',registrationEnabled:env.PUBLIC_REGISTRATION_ENABLED==='1'}):undefined;
  const app=await createApp({environment:'preview',origin,sessionSecret,csrfSecret,contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,contentRepository,accounts,staticRoot:resolve(env.STATIC_ROOT??'build/web')});
  // Keep static bytes on the environment's existing free static hosting.
  app.get('/assets/recipes/*',async(req,reply)=>{
    if(!/^\/assets\/recipes\/[a-zA-Z0-9_.-]+\.(?:png|webp)$/.test(req.url.split('?')[0]))return reply.code(404).send();
    return reply.redirect(`https://shiwei-d2gmiun66b7dc6a4f-1512010497.tcloudbaseapp.com${req.url.split('?')[0]}`);
  });
  await app.listen({host:'0.0.0.0',port:9000});
  for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>void app.close());
  return app;
}
startHttpFunction().catch(error=>{console.error('HTTP_FUNCTION_START_FAILED',typeof error?.code==='string'?error.code:error?.name??'Error');process.exitCode=1;});
