import { readFile, mkdir, open, copyFile, cp, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { build } from 'esbuild';
import { connectDatabase } from '../backend/src/db';
import { ContentRepository } from '../backend/src/content-repository';
import { readCandidateRows } from '../backend/src/gallery-content';
import { galleryBundleHash, verifyGalleryBundle } from '../backend/src/cloudbase-content';

async function main(){
  const directory=resolve(process.argv[2]??'.local-data/cloudbase-http/release-20261023');
  if(!directory.startsWith(resolve('.local-data/cloudbase-http')+'/')&&!directory.startsWith(resolve('.local-data/cloudbase-http')+'\\'))throw Error('RELEASE_PATH_REJECTED');
  await mkdir(dirname(directory),{recursive:true});await mkdir(directory,{recursive:false});
  const url=(await readFile('.local-data/deployment/business-app-url','utf8')).trim(),parsed=new URL(url);
  if(parsed.hostname!=='127.0.0.1'||parsed.pathname!=='/shiwei_business_local'||parsed.username!=='shiwei_app')throw Error('RELEASE_SOURCE_REJECTED');
  const db=await connectDatabase(url,{max:1});
  let bundle;
  try{bundle={base:await new ContentRepository(db).load('local-business-community-v1'),rows:(await readCandidateRows(db)).map(({dish_key,flavor,source_uri,image_url,raw_record})=>({dish_key,flavor,source_uri,image_url,raw_record}))};}
  finally{await db.close();}
  const hash=galleryBundleHash(bundle),snapshot=verifyGalleryBundle(bundle,hash);
  const file=await open(join(directory,'gallery-bundle.json'),'wx',0o600);try{await file.writeFile(JSON.stringify(bundle));}finally{await file.close();}
  const functionDir=join(directory,'function');await mkdir(functionDir);
  await build({entryPoints:['deployment/cloudbase/http-main.ts'],outfile:join(functionDir,'http-main.cjs'),bundle:true,platform:'node',target:'node24',format:'cjs',packages:'external'});
  await copyFile('package.json',join(functionDir,'package.json'));await copyFile('package-lock.json',join(functionDir,'package-lock.json'));
  await mkdir(join(functionDir,'build/web'),{recursive:true});
  await copyFile('artifacts/build/web/index.html',join(functionDir,'build/web/index.html'));
  // Ship UI code with the function. Large recipe images use existing static hosting.
  await cp('artifacts/build/web/assets',join(functionDir,'build/web/assets'),{recursive:true});
  await writeFile(join(functionDir,'scf_bootstrap'),'#!/bin/bash\ncd /var/user\nexec /var/lang/node24/bin/node http-main.cjs\n',{mode:0o755,flag:'wx'});
  const manifest={releaseId:'gallery-preview-20261023',hash,recipes:snapshot.recipes.length,sourceRows:bundle.rows.length,origin:'https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com',runtime:'Nodejs24.11',functionName:'shiwei-http-preview',functionDir};
  await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  console.log(JSON.stringify(manifest));
}
main().catch(()=>{console.error('HTTP_RELEASE_PREPARE_FAILED');process.exitCode=1;});
