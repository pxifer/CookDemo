import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createApp} from '../backend/src/app';
import {verifyGalleryBundle,type GalleryBundle} from '../backend/src/cloudbase-content';
const root='datasets/recipes/expansion-1000',manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const bundle:GalleryBundle=JSON.parse(await readFile(`${root}/gallery-bundle.json`,'utf8'));
const snapshot=verifyGalleryBundle(bundle,manifest.hash);
const port=15203,origin=`http://127.0.0.1:${port}`;
// No cloud, account credentials, model, or knowledge service is initialized here.
const app=await createApp({environment:'local',origin,contentSource:'local-cache',contentRelease:snapshot.contentVersion,contentRepository:{load:async()=>structuredClone(snapshot),candidates:async()=>structuredClone(bundle.rows)},staticRoot:resolve('artifacts/build/web')});
await app.listen({host:'127.0.0.1',port});
console.log(JSON.stringify({url:origin,recipes:snapshot.recipes.length,imagesDeferred:manifest.missingImages,models:false,cloud:false}));
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>void app.close());
