import { readFile, mkdir, copyFile, cp, writeFile, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { build } from 'esbuild';

const source=resolve('.local-data/cloudbase-http/release-20261025-pagination-v25');
const destination=resolve('.local-data/cloudbase-http/release-20261026-swap-images-v26');
await mkdir(destination,{recursive:false});
const config=JSON.parse(await readFile(join(source,'cloudbaserc.json'),'utf8'));
const settings=config.functions?.[0]?.envVariables;
if(config.envId!=='shiwei-d2gmiun66b7dc6a4f'||config.functions.length!==1||config.functions[0].name!=='shiwei-http-preview'
  ||settings?.CONTENT_BUNDLE_ID!=='gallery-preview-20261023'||!settings?.COMPOSITION_RELEASE_ID||!settings?.CLOUDBASE_PUBLISHABLE_KEY
  ||!settings?.SESSION_SECRET_B64||!settings?.CSRF_SECRET_B64||!settings?.PROFILE_ENCRYPTION_KEY_B64||settings?.ACCOUNT_SYNC_ENABLED!=='1')throw Error('PREVIOUS_RELEASE_CONFIGURATION');
const fn=join(destination,'function');await mkdir(fn);
await build({entryPoints:['deployment/cloudbase/http-main.ts'],outfile:join(fn,'http-main.cjs'),bundle:true,platform:'node',target:'node24',format:'cjs',packages:'external'});
for(const name of ['package.json','package-lock.json','scf_bootstrap','index.js'])await copyFile(join(source,'function',name),join(fn,name));
await cp(join(source,'function/node_modules'),join(fn,'node_modules'),{recursive:true});
const excluded=resolve('artifacts/build/web/assets/recipes');
await cp('artifacts/build/web',join(fn,'build/web'),{recursive:true,filter:path=>resolve(path)!==excluded&&!resolve(path).startsWith(excluded+sep)});
await writeFile(join(destination,'cloudbaserc.json'),JSON.stringify(config,null,2),{flag:'wx',mode:0o600});
const upload=join(destination,'images');await mkdir(upload);
const jobs=JSON.parse(await readFile('datasets/recipes/curation/recipe-image-prompts-2026-10-25-complete.json','utf8'));
let bytes=0;
for(const job of jobs)for(const extension of ['png','webp']){
  const from=job.asset.replace(/\.png$/,`.${extension}`),name=job.name.replace(/\.png$/,`.${extension}`);
  bytes+=(await stat(from)).size;await copyFile(from,join(upload,name));
}
console.log(JSON.stringify({prepared:true,revision:'v26',newDishes:jobs.length,imageFiles:jobs.length*2,imageBytes:bytes,existingConfigAndKeysPreserved:true,secretsPrinted:false}));
