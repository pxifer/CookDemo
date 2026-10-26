import { readFile,writeFile,mkdir,copyFile,cp,rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { build } from 'esbuild';

async function main(){
  const revision=process.argv[2]??'v1';
  if(!/^v[1-9][0-9]*$/.test(revision))throw Error('RELEASE_REVISION');
  const sourceRevision=process.argv[3]??'v1';
  if(!/^v[1-9][0-9]*$/.test(sourceRevision)||sourceRevision===revision)throw Error('SOURCE_REVISION');
  const source=resolve('.local-data/cloudbase-http/'+(revision==='v1'?'release-20261023':`release-20261024-account-${sourceRevision}`));
  const directory=resolve('.local-data/cloudbase-http/release-20261024-account-'+revision);
  await mkdir(directory,{recursive:false});
  const fn=join(directory,'function');await mkdir(fn);
  const config=JSON.parse(await readFile(join(source,'cloudbaserc.json'),'utf8'));
  if(config.envId!=='shiwei-d2gmiun66b7dc6a4f'||config.functions.length!==1||config.functions[0].name!=='shiwei-http-preview')throw Error('RELEASE_TARGET');
  if(revision==='v1')Object.assign(config.functions[0].envVariables,{ACCOUNT_SYNC_ENABLED:'1',PROFILE_ENCRYPTION_KEY_B64:randomBytes(32).toString('base64'),PROFILE_KEY_VERSION:'profile-20261024-v1'});
  else if(!config.functions[0].envVariables.PROFILE_ENCRYPTION_KEY_B64)throw Error('PRESERVED_KEY_REQUIRED');
  await build({entryPoints:['cloudbase/http-main.ts'],outfile:join(fn,'http-main.cjs'),bundle:true,platform:'node',target:'node24',format:'cjs',packages:'external'});
  for(const name of ['package.json','package-lock.json','scf_bootstrap','index.js'])await copyFile(join(source,'function',name),join(fn,name));
  await cp(join(source,'function/node_modules'),join(fn,'node_modules'),{recursive:true});
  await mkdir(join(fn,'build'));await cp('build/web',join(fn,'build/web'),{recursive:true});
  // Recipe images are served from CloudBase static hosting by http-main.ts.
  // Excluding the duplicated originals keeps the HTTP function package small.
  await rm(join(fn,'build/web/assets/recipes'),{recursive:true,force:true});
  await writeFile(join(directory,'cloudbaserc.json'),JSON.stringify(config,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({prepared:true,functionName:config.functions[0].name,profileKeyIndependent:true,configSecretsPrinted:false}));
}
main().catch(()=>{console.error('ACCOUNT_HTTP_PREPARE_FAILED');process.exitCode=1;});
