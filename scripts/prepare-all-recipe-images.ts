import {readFile,mkdir,copyFile,cp,writeFile,stat} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {build} from 'esbuild';
const source=resolve('.local-data/cloudbase-http/release-20261026-pagination-ui-v31');
const destination=resolve('.local-data/cloudbase-http/release-20261027-all-recipe-images-v32');
const additions=JSON.parse(await readFile('datasets/recipes/curation/recipe-image-additions-2026-10-27.json','utf8')) as {id:string;dish:string;image:string}[];
if(additions.length!==196||new Set(additions.map(row=>row.dish)).size!==196)throw Error('IMAGE_SET_INCOMPLETE');
for(const row of additions)if(!/^\/assets\/recipes\/[a-z0-9-]+\.webp$/.test(row.image)||(await stat('frontend/public'+row.image)).size<10000)throw Error('IMAGE_ASSET_INVALID');
const rawConfig=await readFile(join(source,'cloudbaserc.json'));
const config=JSON.parse(rawConfig.toString('utf8'));
const fnConfig=config.functions?.[0],env=fnConfig?.envVariables;
if(config.envId!=='shiwei-d2gmiun66b7dc6a4f'||config.functions.length!==1||fnConfig.name!=='shiwei-http-preview'
  ||env.CONTENT_BUNDLE_ID!=='gallery-listed-foods-20261026-v27'||env.ACCOUNT_SYNC_ENABLED!=='1'
  ||!env.SESSION_SECRET_B64||!env.CSRF_SECRET_B64||!env.PROFILE_ENCRYPTION_KEY_B64)throw Error('EXISTING_CONFIG_REQUIRED');
await mkdir(destination,{recursive:false});
const fn=join(destination,'function');await mkdir(fn);
await build({entryPoints:['deployment/cloudbase/http-main.ts'],outfile:join(fn,'http-main.cjs'),bundle:true,platform:'node',target:'node24',format:'cjs',packages:'external'});
for(const name of ['package.json','package-lock.json','scf_bootstrap','index.js'])await copyFile(join(source,'function',name),join(fn,name));
await cp(join(source,'function/node_modules'),join(fn,'node_modules'),{recursive:true});
const excluded=resolve('artifacts/build/web/assets/recipes');
await cp('artifacts/build/web',join(fn,'build/web'),{recursive:true,filter:path=>resolve(path)!==excluded&&!resolve(path).startsWith(excluded+sep)});
await writeFile(join(destination,'cloudbaserc.json'),rawConfig,{flag:'wx',mode:0o600});
const upload=join(destination,'images');await mkdir(upload);
for(const row of additions)await copyFile('frontend/public'+row.image,join(upload,row.image.split('/').pop()!));
await writeFile(join(destination,'image-release.json'),JSON.stringify({contentVersion:env.CONTENT_BUNDLE_ID,configurationUnchanged:true,databaseWrites:false,newImageCount:additions.length,webpOnlyUpload:true})+'\n',{flag:'wx'});
console.log(JSON.stringify({prepared:true,configurationUnchanged:true,databaseWrites:false,secretsPrinted:false}));
