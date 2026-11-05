import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {CloudBaseGalleryRepository,galleryBundleHash,type GalleryBundle} from '../backend/src/cloudbase-content';
import {GALLERY_RELEASE} from '../backend/src/gallery-content';
import {recipeImage} from '../shared/recipe-images';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_PACKAGE_PATH??'C:/Users/彭霄/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const output='artifacts/acceptance/recipe-images-2026-10-27';
const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/listed-foods-20261026-v27/gallery-bundle.json','utf8')) as GalleryBundle;
const original=JSON.stringify(bundle),hash=galleryBundleHash(bundle);
const additions=JSON.parse(await readFile('datasets/recipes/curation/recipe-image-additions-2026-10-27.json','utf8')) as {id:string;dish:string;image:string}[];
const existing=JSON.parse(await readFile('datasets/recipes/curation/recipe-image-completion-2026-10-25.json','utf8')) as {dish:string;image:string}[];
assert.equal(additions.length,196);
assert.equal(new Set(additions.map(item=>item.dish)).size,196);
for(const row of existing)assert.equal(recipeImage(row.dish),row.image,'preserve existing picture');
let published=true;
const fetcher:typeof fetch=async input=>new Response(JSON.stringify(published?(String(input).includes('select=release_id')?[{release_id:'image-check'}]:[{payload:bundle}]):[]));
const repository=new CloudBaseGalleryRepository({envId:'shiwei-test',publishableKey:'test-public',releaseId:'image-check',hash,fetch:fetcher});
const snapshot=await repository.load(GALLERY_RELEASE),rows=await repository.candidates();
assert.equal(snapshot.recipes.length,341);
assert.equal(snapshot.contentVersion,bundle.listedFoodSnapshot!.contentVersion);
const previousPictures=bundle.listedFoodSnapshot!.recipes.filter(recipe=>recipe.imageUrl);
assert.equal(previousPictures.length,145);
for(const before of previousPictures){
  const after=snapshot.recipes.find(recipe=>recipe.id===before.id)!;
  assert.equal(new URL(after.imageUrl!).pathname,new URL(before.imageUrl!,'https://previous.example').pathname,'preserve existing picture: '+before.name);
}
const records=[];
for(const recipe of snapshot.recipes){
  assert(recipe.imageUrl,recipe.name);
  const path=new URL(recipe.imageUrl).pathname;
  assert.match(path,/^\/assets\/recipes\/[a-z0-9-]+\.(png|webp)$/);
  const raw=await readFile('frontend/public'+path),metadata=await sharp(raw).metadata();
  await sharp(raw).raw().toBuffer();
  assert(metadata.width>=1000&&metadata.height>=700,recipe.name);
  const matchingRows=rows.filter(row=>row.dish_key===recipe.name);
  assert(matchingRows.length,recipe.name);
  assert(matchingRows.every(row=>row.image_url===recipe.imageUrl),'gallery and workspace photo agree: '+recipe.name);
  records.push({name:recipe.name,path,bytes:raw.length,width:metadata.width,height:metadata.height,sha256:createHash('sha256').update(raw).digest('hex')});
}
assert.equal(new Set(records.map(record=>record.path)).size,341,'each dish has its own photo');
assert.equal(new Set(records.map(record=>record.sha256)).size,341,'no duplicate asset substituted');
assert.equal(JSON.stringify(bundle),original,'immutable content release was not mutated');
published=false;
await assert.rejects(repository.load(GALLERY_RELEASE),{code:'CONTENT_NOT_READY'});
await mkdir(output,{recursive:true});
await writeFile(output+'/coverage.json',JSON.stringify({total:341,newPictures:196,existingPictures:145,decoded:records.length,contentVersion:snapshot.contentVersion,contentUnchanged:true,publicationWithdrawalChecked:true,records},null,2)+'\n');
console.log(JSON.stringify({total:341,newPictures:196,decoded:records.length,contentUnchanged:true}));

