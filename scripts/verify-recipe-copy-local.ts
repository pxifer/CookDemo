import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createApp} from '../server/app';
import {GALLERY_RELEASE} from '../server/gallery-content';
import {verifyGalleryBundle,type GalleryBundle} from '../server/cloudbase-content';
const output=process.argv[2]??'acceptance/recipe-copy-2026-10-26';
const root='.local-data/cloudbase-http/listed-foods-20261026-v27';
const bundle=JSON.parse(await readFile(`${root}/gallery-bundle.json`,'utf8')) as GalleryBundle;
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const snapshot=verifyGalleryBundle(bundle,manifest.hash);
const app=await createApp({environment:'preview',origin:'https://shiwei.example',contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,
  sessionSecret:randomBytes(32),csrfSecret:randomBytes(32),staticRoot:resolve('build/web'),
  contentRepository:{load:async()=>snapshot,candidates:async()=>bundle.rows}});
await mkdir(output,{recursive:false});
const origin=await app.listen({host:'127.0.0.1',port:0});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'zh-CN',reducedMotion:'reduce'});
  const row=bundle.rows.find(row=>row.raw_record.id==='R111')!;
  await page.goto(`${origin}/recipes?q=${encodeURIComponent(row.dish_key)}`);
  await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
  await page.locator('.library-recipe-columns').waitFor();
  assert((await page.locator('.recipe-source').innerText()).startsWith('来源：央视网'));
  assert.doesNotMatch(await page.locator('.library-recipe-detail').innerText(),/公开配方资料|保留原始出处|用量未注明|未定量/);
  assert.equal(await page.locator('.library-recipe-columns .steps li').count(),6);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${output}/desktop-detail.png`,fullPage:true});
  const gallery=(await app.inject('/api/v1/local/candidate-recipes')).json();
  const ingredients=gallery.recipes.flatMap((row:any)=>[...(row.raw_record.main??[]),...(row.raw_record.aux??[]),...(row.raw_record.seasonings??[])]);
  assert(!ingredients.some((text:string)=>/用量未注明|未注明用量|未定量|来源未给用量/.test(text)));
  const catalog=(await app.inject('/api/v1/catalog/recipes')).json();
  const before=snapshot.recipes.map(recipe=>({id:recipe.id,imageUrl:recipe.imageUrl,variants:recipe.variants.map(variant=>({id:variant.id,lines:variant.lines.map(({sourceText,...line})=>line)}))}));
  const after=catalog.recipes.map((recipe:any)=>({id:recipe.id,imageUrl:recipe.imageUrl,variants:recipe.variants.map((variant:any)=>({id:variant.id,lines:variant.lines.map(({sourceText,...line}:any)=>line)}))}));
  assert.deepEqual(after,before);
  assert(catalog.recipes.every((recipe:any)=>recipe.variants.every((variant:any)=>variant.steps.length>=3)));
  const report={desktopVerified:true,sourceRetained:true,editorialSuffixRemoved:true,ingredientNamesAndKnownAmountsRetained:true,
    reviewedMethodsHaveAtLeastThreeSteps:true,recipeIdsImagesAndIngredientDataUnchanged:true,databaseWrites:false};
  await writeFile(`${output}/local-verification.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(report));
}finally{await browser.close();await app.close();}
