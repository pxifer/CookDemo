import { readFile, mkdir, copyFile, cp, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { build } from 'esbuild';
const source=resolve('.local-data/cloudbase-http/release-20261027-all-recipe-images-v32');
const revision=process.argv[2]??'v40';if(!/^v(33|34|35|36|37|38|39|40)$/.test(revision))throw Error('RELEASE_REVISION');
const directory=resolve(`.local-data/cloudbase-http/release-20261027-health-chat-${revision}`);
const previousMigrations=resolve('.local-data/cloudbase-http/listed-foods-20261026-v27/migration/cloudbase/migrations');
const config=JSON.parse(await readFile(join(source,'cloudbaserc.json'),'utf8'));
if(config.envId!=='shiwei-d2gmiun66b7dc6a4f'||config.functions?.length!==1||config.functions[0].name!=='shiwei-http-preview'||config.functions[0].envVariables.ACCOUNT_SYNC_ENABLED!=='1')throw Error('PREVIOUS_RELEASE_REQUIRED');
await mkdir(directory,{recursive:false});const fn=join(directory,'function');await mkdir(fn);
await build({entryPoints:['cloudbase/http-main.ts'],outfile:join(fn,'http-main.cjs'),bundle:true,platform:'node',target:'node24',format:'cjs',packages:'external'});
for(const file of ['package.json','package-lock.json','scf_bootstrap','index.js'])await copyFile(join(source,'function',file),join(fn,file));
await cp(join(source,'function/node_modules'),join(fn,'node_modules'),{recursive:true});
const excluded=resolve('build/web/assets/recipes');await cp('build/web',join(fn,'build/web'),{recursive:true,filter:path=>resolve(path)!==excluded&&!resolve(path).startsWith(excluded+sep)});
// Preserve every existing secret and deployment setting byte-for-byte.
await copyFile(join(source,'cloudbaserc.json'),join(directory,'cloudbaserc.json'));
const migrations=join(directory,'migration/cloudbase/migrations');await mkdir(migrations,{recursive:true});
for(const name of await readdir(previousMigrations)){if(name.endsWith('.sql'))await copyFile(join(previousMigrations,name),join(migrations,name));}
await copyFile('deploy/db/health-chat.sql',join(migrations,'20261027200000_health_chat.sql'));
await writeFile(join(directory,'manifest.json'),JSON.stringify({release:`health-chat-${revision}`,migration:'20261027200000',configurationUnchanged:true,personalKeyStored:true,personalKeyEncrypted:true,personalKeyReturned:false,platformModelKey:false},null,2),{flag:'wx'});
console.log(JSON.stringify({prepared:true,revision:`health-chat-${revision}`,appendOnlyMigration:true,existingConfigurationPreserved:true,secretsPrinted:false}));
