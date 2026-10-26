import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {defaultMeal} from '../shared/types';
import {contentContext} from '../shared/content';
import {inputIngredient} from '../src/meal-input';
import {createApp} from '../server/app';
import {GALLERY_RELEASE} from '../server/gallery-content';
import {verifyGalleryBundle,type GalleryBundle} from '../server/cloudbase-content';

const live=process.argv.includes('--live');
const output=`acceptance/pagination-ui-2026-10-26/${live?'live':'local'}`;
const root='.local-data/cloudbase-http/listed-foods-20261026-v27';
const bundle=JSON.parse(await readFile(`${root}/gallery-bundle.json`,'utf8')) as GalleryBundle;
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const snapshot=verifyGalleryBundle(bundle,manifest.hash);
const app=await createApp({environment:'preview',origin:'https://shiwei.example',contentSource:'cloudbase',contentRelease:GALLERY_RELEASE,
  sessionSecret:randomBytes(32),csrfSecret:randomBytes(32),staticRoot:resolve('build/web'),
  contentRepository:{load:async()=>snapshot,candidates:async()=>bundle.rows}});
await mkdir(output,{recursive:true});
await app.ready();
const origin=live?'https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com':'https://shiwei.example';
const browser=await chromium.launch({channel:'msedge',headless:true});
const reports:unknown[]=[];
try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]] as const){
    const page=await browser.newPage({viewport:{width,height},locale:'zh-CN',reducedMotion:'no-preference'});
    // All HTTPS requests execute against the local app, including secure session cookies.
    if(!live)await page.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      if(path.startsWith('/assets/recipes/')){
        await route.fulfill({body:await readFile(resolve('public',path.slice(1))),contentType:path.endsWith('.webp')?'image/webp':'image/png'});return;
      }
      assert.equal(url.origin,origin);
      const response=await app.inject({method:request.method() as 'GET'|'POST',url:path+url.search,headers:request.headers(),payload:request.postDataBuffer()??undefined});
      await route.fulfill({status:response.statusCode,headers:Object.fromEntries(Object.entries(response.headers).map(([key,value])=>[key,Array.isArray(value)?value.join('\n'):String(value)])),body:response.rawPayload});
    });
    page.setDefaultTimeout(30000);
    await page.goto(origin);
    if(live){const confirmation=page.getByRole('button',{name:'确定访问',exact:true});await confirmation.or(page.locator('.site-header')).first().waitFor();if(await confirmation.isVisible())await confirmation.click();}
    await page.getByLabel('允许补买食材',{exact:false}).check();
    await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
    await expect(page.getByTestId('recipe-card')).toHaveCount(6);
    const firstNames=await page.locator('.recipe-card h4').allTextContents();
    const measure=async(gridSelector:string,buttonName:string,pageSelector:string,expectedPage:string)=>{
      const button=page.getByRole('button',{name:buttonName,exact:true});await button.scrollIntoViewIfNeeded();
      await page.evaluate(selector=>{
        (window as any).paginationFirstPaint=undefined;(window as any).pageScrollCalls=[];
        const saved=window.scrollTo;
        window.scrollTo=function(...args:any[]){(window as any).pageScrollCalls.push(args[0]);return (saved as any).apply(window,args);};
        const observer=new MutationObserver(()=>{observer.disconnect();requestAnimationFrame(()=>{
          (window as any).paginationFirstPaint=document.querySelector(selector)!.getBoundingClientRect().top;
          window.scrollTo=saved;
        });});observer.observe(document.querySelector(selector)!,{childList:true,subtree:true,characterData:true});
      },gridSelector);
      const started=performance.now();
      await button.click();
      await expect(page.locator(pageSelector)).toContainText(expectedPage);
      await expect.poll(()=>page.evaluate(()=>(window as any).paginationFirstPaint)).toBeCloseTo(16,0);
      const measured=await page.evaluate(async(selector)=>{
        const samples:number[]=[];for(let i=0;i<3;i++){await new Promise(requestAnimationFrame);samples.push(document.querySelector(selector)!.getBoundingClientRect().top);}
        return {firstPaint:(window as any).paginationFirstPaint,samples,calls:(window as any).pageScrollCalls};
      },gridSelector);
      assert(measured.samples.every(y=>Math.abs(y-16)<1));
      assert(measured.calls.some((call:any)=>call?.behavior==='instant'));
      assert(!measured.calls.some((call:any)=>call?.behavior==='smooth'));
      return {button:buttonName,elapsedMs:Math.round(performance.now()-started),...measured};
    };
    const workspaceNext=await measure('.recipe-grid','下一页','.result-actions','2 /');
    const workspacePrevious=await measure('.recipe-grid','上一页','.result-actions','1 /');
    assert.deepEqual(await page.locator('.recipe-card h4').allTextContents(),firstNames);
    await page.screenshot({path:`${output}/${name}-workspace-first-row.png`});
    await page.goto(`${origin}/recipes`);await expect(page.locator('.candidate-card')).toHaveCount(24);
    const libraryNames=await page.locator('.candidate-card h2').allTextContents();
    const libraryNext=await measure('.candidate-grid','下一页','.library-pagination','2 /');
    const libraryPrevious=await measure('.candidate-grid','上一页','.library-pagination','1 /');
    assert.deepEqual(await page.locator('.candidate-card h2').allTextContents(),libraryNames);
    await page.screenshot({path:`${output}/${name}-library-first-row.png`});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    reports.push({name,workspaceNext,workspacePrevious,libraryNext,libraryPrevious});
    await page.close();
  }
  await writeFile(`${output}/verification.json`,JSON.stringify(reports,null,2)+'\n');
  console.log(JSON.stringify(reports));
}finally{await browser.close();await app.close();}
