import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createApp} from '../backend/src/app';
import {GALLERY_RELEASE} from '../backend/src/gallery-content';
import {verifyGalleryBundle,type GalleryBundle} from '../backend/src/cloudbase-content';

const output='artifacts/acceptance/recipe-ui-2026-10-26';
const root='.local-data/cloudbase-http/listed-foods-20261026-v27';
const bundle=JSON.parse(await readFile(`${root}/gallery-bundle.json`,'utf8')) as GalleryBundle;
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const snapshot=verifyGalleryBundle(bundle,manifest.hash);
const app=await createApp({environment:'preview',origin:'https://shiwei.example',contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,
  sessionSecret:randomBytes(32),csrfSecret:randomBytes(32),staticRoot:resolve('artifacts/build/web'),
  contentRepository:{load:async()=>snapshot,candidates:async()=>bundle.rows}});
await mkdir(output,{recursive:true});
await app.ready();
const origin='https://shiwei.example';
const browser=await chromium.launch({channel:'msedge',headless:true});
const reports:unknown[]=[];
try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]] as const){
    const page=await browser.newPage({viewport:{width,height},locale:'zh-CN',reducedMotion:'no-preference'});
    // All HTTPS requests execute against the local app, including secure session cookies.
    await page.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      if(path.startsWith('/assets/recipes/')){
        await route.fulfill({body:await readFile(resolve('frontend/public',path.slice(1))),contentType:path.endsWith('.webp')?'image/webp':'image/png'});return;
      }
      assert.equal(url.origin,origin);
      const response=await app.inject({method:request.method() as 'GET'|'POST',url:path+url.search,headers:request.headers(),payload:request.postDataBuffer()??undefined});
      await route.fulfill({status:response.statusCode,headers:Object.fromEntries(Object.entries(response.headers).map(([key,value])=>[key,Array.isArray(value)?value.join('\n'):String(value)])),body:response.rawPayload});
    });
    await page.goto(`${origin}/recipes?page=2`);
    const card=page.locator('.candidate-card').nth(19);
    const dish=await card.locator('h2').innerText();
    const open=card.locator('.candidate-card-actions button').first();
    await open.scrollIntoViewIfNeeded();
    const listY=await page.evaluate(()=>scrollY);assert(listY>500);
    await page.evaluate(()=>{
      const observer=new MutationObserver(()=>{
        if(!document.querySelector('.library-recipe-detail'))return;
        observer.disconnect();requestAnimationFrame(()=>{
          (window as any).detailFirstPaint={y:scrollY,heading:document.querySelector('.library-recipe-heading h2')!.getBoundingClientRect().top};
        });
      });observer.observe(document.body,{childList:true,subtree:true});
    });
    await open.click();
    await expect(page.locator('.library-recipe-heading h2')).toHaveText(dish);
    await expect.poll(()=>page.evaluate(()=>(window as any).detailFirstPaint?.y)).toBe(0);
    const firstPaint=await page.evaluate(()=>(window as any).detailFirstPaint);
    assert(firstPaint.heading>=0&&firstPaint.heading<height);
    await expect(page.locator('.recipe-source a')).toHaveCount(0);
    await page.goBack();await expect(page.locator('.candidate-card')).toHaveCount(24);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(listY,0);
    await expect(page.getByRole('button',{name:`查看${dish}做法`,exact:true})).toBeFocused();
    await page.goForward();await expect(page.locator('.library-recipe-heading h2')).toHaveText(dish);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
    await page.reload();await expect(page.locator('.library-recipe-heading h2')).toHaveText(dish);
    const bottom=page.locator('.library-detail-footer button');await bottom.click();
    await expect(page.locator('.candidate-card')).toHaveCount(24);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(listY,0);
    await card.locator('.candidate-card-actions button').first().click();
    await page.locator('.library-back').first().click();
    await expect(page.locator('.candidate-card')).toHaveCount(24);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(listY,0);
    await page.goto(`${origin}/recipes?dish=${encodeURIComponent('凉拌黄瓜')}`);
    await expect(page.locator('.library-recipe-columns')).toContainText('醋11.5ml');
    await expect(page.locator('.library-recipe-columns')).not.toContainText('份数');
    await page.screenshot({path:`${output}/${name}-gallery-detail.png`,fullPage:true});
    await page.goto(origin);
    await page.getByLabel('允许补买食材',{exact:false}).check();
    await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
    await expect(page.getByTestId('recipe-card').first()).toBeVisible();
    const photo=page.getByTestId('recipe-card').first().locator('.card-photo img');
    await photo.evaluate((img:HTMLImageElement)=>img.decode());
    expect(await photo.evaluate(img=>getComputedStyle(img).objectFit)).toBe('contain');
    const buy=page.locator('.set-checks');
    await expect(buy).toHaveCount(1);await expect(buy.locator('details')).toHaveCount(0);
    await buy.locator('summary').click();await expect(buy.locator('.checks li').first()).toBeVisible();
    await page.locator('.recipe-grid').screenshot({path:`${output}/${name}-workspace.png`});
    await page.getByTestId('recipe-card').first().getByRole('button',{name:'看看做法 ↗'}).click();
    const modal=page.getByRole('dialog');await expect(modal).toBeVisible();
    await expect(modal.locator('.recipe-source')).toContainText('来源：');
    await expect(modal.locator('.recipe-source a')).toHaveCount(0);
    const detailImage=modal.locator('img.detail-photo');
    await detailImage.evaluate((img:HTMLImageElement)=>img.decode());
    const imageSize=await detailImage.evaluate((img:HTMLImageElement)=>({ratio:img.width/img.height,natural:img.naturalWidth/img.naturalHeight}));
    assert(Math.abs(imageSize.ratio-imageSize.natural)<0.02);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`${output}/${name}-workspace-detail.png`});
    reports.push({name,listY,firstPaint,historyAndBothReturnButtonsRestorePosition:true,sourceTextOnly:true,imagesUncropped:true,singleShoppingDisclosure:true,noHorizontalOverflow:true});
    await page.close();
  }
  await writeFile(`${output}/verification.json`,JSON.stringify(reports,null,2)+'\n');
  console.log(JSON.stringify(reports));
}finally{await browser.close();await app.close();}
