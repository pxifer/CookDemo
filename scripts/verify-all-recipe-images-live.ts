import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const origin='https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com';
const assets=JSON.parse(await readFile('acceptance/recipe-images-2026-10-27/assets.json','utf8'));
const coverage=JSON.parse(await readFile('acceptance/recipe-images-2026-10-27/coverage.json','utf8'));
const response=await fetch(origin+'/api/v1/catalog/recipes',{signal:AbortSignal.timeout(30000)});
assert(response.ok);const catalog=await response.json();assert.equal(catalog.contentVersion,coverage.contentVersion);assert.equal(catalog.recipes.length,341);
for(const expected of coverage.records){const actual=catalog.recipes.find((recipe:any)=>recipe.name===expected.name);assert(actual?.imageUrl,expected.name);assert.equal(new URL(actual.imageUrl).pathname,expected.path,expected.name);}
let next=0;const checked:any[]=[];
await Promise.all(Array.from({length:8},async()=>{while(next<assets.records.length){const item=assets.records[next++];const url='https://shiwei-d2gmiun66b7dc6a4f-1512010497.tcloudbaseapp.com'+item.image;const result=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error'});assert.equal(result.status,200,item.dish);assert.match(result.headers.get('content-type')??'',/^image\/webp/);const bytes=Buffer.from(await result.arrayBuffer());assert.equal(bytes.length,item.webpBytes,item.dish);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.webpSha256,item.dish);checked.push({dish:item.dish,url,bytes:bytes.length,sha256:item.webpSha256});}}));
assert.equal(checked.length,196);
await mkdir('acceptance/recipe-images-2026-10-27/live',{recursive:true});await writeFile('acceptance/recipe-images-2026-10-27/live/static-verification.json',JSON.stringify({catalog:341,newPicturesVerified:196,contentVersion:catalog.contentVersion,checked},null,2)+'\n');
console.log(JSON.stringify({catalog:341,newPicturesVerified:196,hashesMatch:true,contentVersion:catalog.contentVersion}));
