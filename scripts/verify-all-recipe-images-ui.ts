import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,expect as baseExpect} from '@playwright/test';
import {createApp} from '../server/app';
import {GALLERY_RELEASE} from '../server/gallery-content';
import {CloudBaseGalleryRepository,galleryBundleHash,type GalleryBundle} from '../server/cloudbase-content';
const expect=baseExpect.configure({timeout:30000});
const live=process.argv.includes('--live');
const output=`acceptance/recipe-images-2026-10-27/${live?'live':'local'}`;
const bundle=JSON.parse(await readFile('.local-data/cloudbase-http/listed-foods-20261026-v27/gallery-bundle.json','utf8')) as GalleryBundle;
const repository=new CloudBaseGalleryRepository({envId:'shiwei-test',publishableKey:'test-public',releaseId:'images-test',hash:galleryBundleHash(bundle),fetch:async input=>new Response(JSON.stringify(String(input).includes('select=release_id')?[{release_id:'images-test'}]:[{payload:bundle}]))});
const app=await createApp({environment:'preview',origin:'https://shiwei.example',contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,sessionSecret:randomBytes(32),csrfSecret:randomBytes(32),staticRoot:resolve('build/web'),contentRepository:repository});
await app.ready();await mkdir(output,{recursive:true});
const origin=live?'https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com':'https://shiwei.example';
const browser=await chromium.launch({channel:'msedge',headless:true});
const reports=[];
try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]] as const){
    const page=await browser.newPage({viewport:{width,height},locale:'zh-CN'});page.setDefaultTimeout(30000);
    if(!live)await page.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.pathname.startsWith('/assets/recipes/')){await route.fulfill({body:await readFile('public'+url.pathname),contentType:url.pathname.endsWith('.webp')?'image/webp':'image/png'});return;}
      assert.equal(url.origin,origin);
      const response=await app.inject({method:request.method() as 'GET'|'POST',url:url.pathname+url.search,headers:request.headers(),payload:request.postDataBuffer()??undefined});
      await route.fulfill({status:response.statusCode,headers:Object.fromEntries(Object.entries(response.headers).map(([key,value])=>[key,Array.isArray(value)?value.join('\n'):String(value)])),body:response.rawPayload});
    });
    await page.goto(origin+'/recipes');
    if(live){const confirm=page.getByRole('button',{name:'确定访问',exact:true});await confirm.or(page.locator('.candidate-grid')).first().waitFor();if(await confirm.isVisible())await confirm.click();}
    const catalog=await page.evaluate(async()=>{const r=await fetch('/api/v1/catalog/recipes');if(!r.ok)throw Error('CATALOG_READ_FAILED');return r.json();});
    assert.equal(catalog.recipes.length,341);assert(catalog.recipes.every((recipe:any)=>recipe.imageUrl));
    const seen=new Set<string>();
    for(let index=0;index<(name==='desktop'?15:2);index++){
      const expected=Math.min(24,341-index*24);try{await expect(page.locator('.candidate-card')).toHaveCount(expected);}catch(error){await page.screenshot({path:output+'/'+name+'-gallery-failure.png'});console.log(JSON.stringify({surface:name,page:index+1,url:page.url(),body:(await page.locator('body').innerText()).slice(0,1600)}));throw error;}
      await page.locator('.candidate-photo img').evaluateAll(images=>images.forEach(image=>(image as HTMLImageElement).loading='eager'));
      await expect.poll(()=>page.locator('.candidate-photo img').evaluateAll(images=>images.filter(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>=1000).length)).toBe(expected);
      assert.equal(await page.locator('.candidate-no-photo').count(),0);
      for(const dish of await page.locator('.candidate-card h2').allTextContents()){assert(!seen.has(dish));seen.add(dish);}
      if(index===0||index===14)await page.screenshot({path:`${output}/${name}-gallery-page-${index+1}.png`});
      if(index<((name==='desktop'?15:2)-1))await page.getByRole('button',{name:'下一页',exact:true}).click();
    }
    if(name==='desktop')assert.equal(seen.size,341);
    for(const dish of ['番茄炒蛋','紫菜萝卜汤','辣椒炒肉片']){
      await page.goto(origin+'/recipes?dish='+encodeURIComponent(dish));
      await expect(page.locator('.library-recipe-heading h2')).toHaveText(dish);
      const image=page.locator('.candidate-detail-image');await image.scrollIntoViewIfNeeded();
      await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.complete&&element.naturalWidth>=1000)).toBe(true);
      await page.screenshot({path:`${output}/${name}-detail-${encodeURIComponent(dish)}.png`});
    }
    await page.goto(origin);
    await page.getByLabel('允许补买食材',{exact:false}).check();
    await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
    await expect(page.getByTestId('recipe-card')).toHaveCount(6);
    await page.locator('.recipe-card img').evaluateAll(images=>images.forEach(image=>(image as HTMLImageElement).loading='eager'));
    await expect.poll(()=>page.locator('.recipe-card img').evaluateAll(images=>images.filter(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>=1000).length)).toBe(6);
    await page.locator('.recipe-grid').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${name}-workspace.png`});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    reports.push({surface:name,galleryPicturesDecoded:seen.size,detailPicturesDecoded:3,workspacePicturesDecoded:6,contentVersion:catalog.contentVersion});
    await page.close();
  }
  await writeFile(output+'/browser-verification.json',JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports));
}finally{await browser.close();await app.close();}


