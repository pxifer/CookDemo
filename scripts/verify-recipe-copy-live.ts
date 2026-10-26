import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {verifyGalleryBundle} from '../server/cloudbase-content';
import methodReview from '../docs/data/recipe-step-review-v28.json';
const output='acceptance/recipe-copy-2026-10-26-verified';
const origin='https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com';
const root='.local-data/cloudbase-http/listed-foods-20261026-v27';
const bundle=JSON.parse(await readFile(`${root}/gallery-bundle.json`,'utf8'));
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const snapshot=verifyGalleryBundle(bundle,manifest.hash);
const get=async(path:string)=>{const res=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});assert(res.ok,`HTTP ${res.status}`);return res.json();};
const catalog=await get('/api/v1/catalog/recipes');
assert.equal(catalog.contentVersion,manifest.releaseId);
const assetOrigin='https://shiwei-d2gmiun66b7dc6a4f-1512010497.tcloudbaseapp.com';
const shape=(recipes:any[])=>recipes.map(recipe=>({id:recipe.id,imageUrl:recipe.imageUrl?.startsWith(assetOrigin+'/')?recipe.imageUrl.slice(assetOrigin.length):recipe.imageUrl,variants:recipe.variants.map((variant:any)=>({id:variant.id,lines:variant.lines.map(({sourceText,...line}:any)=>line)}))}));
assert.deepEqual(shape(catalog.recipes),shape(snapshot.recipes));
assert(catalog.recipes.every((recipe:any)=>recipe.variants.every((variant:any)=>variant.steps.length>=3)));
const gallery=await get('/api/v1/local/candidate-recipes');
assert.equal(gallery.recipes.length,bundle.rows.length);
assert.doesNotMatch(JSON.stringify({catalog,gallery}),/公开配方资料[；;]保留原始出处|用量未注明|未注明用量|未定量|来源未给用量/);
let reviewed=0;
for(const row of gallery.recipes){
  const edit=methodReview.recipes[row.raw_record.id as keyof typeof methodReview.recipes];
  if(edit){assert.deepEqual(row.raw_record.steps,edit.steps);reviewed++;}
}
assert.equal(reviewed,Object.keys(methodReview.recipes).length);
const row=gallery.recipes.find((row:any)=>row.raw_record.id==='R111');assert(row);
const browser=await chromium.launch({channel:'msedge',headless:true});
const screens=[];
try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]] as const){
    const context=await browser.newContext({viewport:{width,height},locale:'zh-CN',reducedMotion:'reduce'});
    const page=await context.newPage();page.setDefaultTimeout(30000);
    await page.goto(`${origin}/recipes?q=${encodeURIComponent(row.dish_key)}`);
    const confirmation=page.getByRole('button',{name:'确定访问',exact:true});
    await confirmation.or(page.locator('.site-header')).first().waitFor();
    if(await confirmation.isVisible())await confirmation.click();
    await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
    await page.locator('.library-recipe-columns').waitFor();
    assert((await page.locator('.recipe-source').innerText()).startsWith('来源：央视网'));
    assert.doesNotMatch(await page.locator('.library-recipe-detail').innerText(),/公开配方资料|保留原始出处|用量未注明|未定量/);
    assert.equal(await page.locator('.library-recipe-columns .steps li').count(),6);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`${output}/live-${name}.png`,fullPage:true});
    screens.push({name,sourceClean:true,steps:6,quantityNotesRemoved:true,noOverflow:true});
    await context.close();
  }
}finally{await browser.close();}
const report={online:true,recipes:catalog.recipes.length,variants:catalog.recipes.reduce((n:number,r:any)=>n+r.variants.length,0),
  reviewedMethods:reviewed,allMethodsAtLeastThreeSteps:true,foodAndImageDataUnchanged:true,contentVersion:catalog.contentVersion,
  databaseWrites:false,realAccountsUsed:false,screens};
await writeFile(`${output}/live-verification.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
