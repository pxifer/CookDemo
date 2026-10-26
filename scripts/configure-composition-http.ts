import { readFile,writeFile } from 'node:fs/promises';
import { COMPOSITION_RELEASE,compositionHash } from '../server/composition-review';
async function main(){
  const path='.local-data/cloudbase-http/release-20261024-account-v3/cloudbaserc.json';
  const config=JSON.parse(await readFile(path,'utf8'));
  const previous=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261024-account-v2/cloudbaserc.json','utf8'));
  const manifest=JSON.parse(await readFile('.local-data/cloudbase-http/composition-review-20261024-v1/manifest.json','utf8'));
  const payload=JSON.parse(await readFile('.local-data/cloudbase-http/composition-review-20261024-v1/review-payload.json','utf8'));
  if(config.envId!=='shiwei-d2gmiun66b7dc6a4f'||config.functions.length!==1||config.functions[0].name!=='shiwei-http-preview'||manifest.releaseId!==COMPOSITION_RELEASE||compositionHash(payload)!==manifest.hash)throw Error('TARGET_OR_HASH');
  const env=config.functions[0].envVariables,old=previous.functions[0].envVariables;
  for(const key of ['SESSION_SECRET_B64','CSRF_SECRET_B64','PROFILE_ENCRYPTION_KEY_B64','PROFILE_KEY_VERSION','CONTENT_BUNDLE_ID','CONTENT_BUNDLE_SHA256','CLOUDBASE_PUBLISHABLE_KEY'])if(!env[key]||env[key]!==old[key])throw Error('KEY_OR_CONTENT_CHANGED');
  Object.assign(env,{COMPOSITION_RELEASE_ID:COMPOSITION_RELEASE,COMPOSITION_RELEASE_SHA256:manifest.hash});
  await writeFile(path,JSON.stringify(config,null,2),{mode:0o600});
  console.log(JSON.stringify({prepared:true,independentProfileKeyPreserved:true,sessionKeysPreserved:true,baseReleasePreserved:true,compositionRelease:COMPOSITION_RELEASE,secretsPrinted:false}));
}
main().catch(()=>{console.error('COMPOSITION_HTTP_CONFIGURATION_FAILED');process.exitCode=1;});
