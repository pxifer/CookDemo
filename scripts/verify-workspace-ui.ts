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
const output=process.env.ACCEPTANCE_DIR??`acceptance/workspace-ui-2026-10-26/${live?'live':'local'}`;
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
    await page.goto(`${origin}/recipes?page=2`);
    if(live){
      const confirmation=page.getByRole('button',{name:'确定访问',exact:true});
      await confirmation.or(page.locator('.site-header')).first().waitFor();
      if(await confirmation.isVisible())await confirmation.click();
    }
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
    const illustratedCard=page.getByTestId('recipe-card').filter({has:page.locator('.card-photo img')}).first();
    const photo=illustratedCard.locator('.card-photo img');
    await photo.evaluate((img:HTMLImageElement)=>img.decode());
    expect(await photo.evaluate(img=>getComputedStyle(img).objectFit)).toBe('contain');
    const buy=page.locator('.set-checks');
    await expect(buy).toHaveCount(1);await expect(buy.locator('details')).toHaveCount(0);
    await buy.locator('summary').click();await expect(buy.locator('.checks li').first()).toBeVisible();
    await page.locator('.recipe-grid').screenshot({path:`${output}/${name}-workspace.png`});
    await illustratedCard.getByRole('button',{name:'看看做法 ↗'}).click();
    const modal=page.getByRole('dialog');await expect(modal).toBeVisible();
    await expect(modal.locator('.recipe-source')).toContainText('来源：');
    await expect(modal.locator('.recipe-source a')).toHaveCount(0);
    const detailImage=modal.locator('img.detail-photo');
    await detailImage.evaluate((img:HTMLImageElement)=>img.decode());
    const imageSize=await detailImage.evaluate((img:HTMLImageElement)=>({ratio:img.width/img.height,natural:img.naturalWidth/img.naturalHeight}));
    assert(Math.abs(imageSize.ratio-imageSize.natural)<0.02);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`${output}/${name}-workspace-detail.png`});
    await modal.getByRole('button',{name:'关闭弹层'}).click();
    const picker=page.locator('.food-picker');
    await picker.getByLabel('食材分类',{exact:true}).selectOption('肉禽');
    await picker.getByLabel('选择食材',{exact:true}).selectOption('牛肉');
    await picker.getByRole('button',{name:'添加',exact:true}).click();
    await expect(page.locator('.ingredients')).toContainText('牛肉');
    await picker.getByLabel('食材分类',{exact:true}).selectOption('蔬菜');
    await picker.getByLabel('选择食材',{exact:true}).selectOption('西兰花');
    await picker.getByRole('button',{name:'添加',exact:true}).click();
    await expect(page.locator('.ingredients')).toContainText('西兰花');
    await page.locator('.ingredient-panel').screenshot({path:`${output}/${name}-food-picker.png`});
    let fixtureVersion=100;
    const seed=async(meal:ReturnType<typeof defaultMeal>)=>{
      meal={...meal,version:fixtureVersion+=100};
      await page.evaluate(meal=>{localStorage.clear();localStorage.setItem('shiwei:guest:meal:v1',JSON.stringify(meal));},meal);
      await page.reload();await expect(page.getByRole('button',{name:'安排这一餐',exact:true})).toBeVisible();
    };
    const context=contentContext(snapshot);
    const tomatoMeal={...defaultMeal(),allowBuy:true,mode:'candidates' as const,ingredients:['西红柿','鸡蛋'].map(n=>inputIngredient(n,context))};
    await seed(tomatoMeal);await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
    try{await expect(page.getByTestId('recipe-card')).toHaveCount(6);}catch(error){console.log((await page.locator('body').innerText()).slice(-4500));throw error;}
    const tomato=page.getByTestId('recipe-card').filter({has:page.getByRole('heading',{name:'番茄炒蛋',exact:true})});
    await expect(tomato).toHaveCount(1);
    const select=tomato.getByRole('combobox');
    const previous=await select.inputValue(),options=await select.locator('option').evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value));
    const next=options.find(value=>value!==previous)!;
    await select.scrollIntoViewIfNeeded();
    const beforeY=await page.evaluate(()=>scrollY);
    const before=await page.getByTestId('recipe-card').evaluateAll(cards=>{
      (window as any).originalCards=cards;
      return cards.map(card=>({title:card.querySelector('h4')!.textContent,text:card.textContent}));
    });
    let navigations=0;const navigated=()=>navigations++;page.on('framenavigated',navigated);
    await select.selectOption(next);await expect(select).toHaveValue(next);await expect(select).toBeEnabled();
    page.off('framenavigated',navigated);assert.equal(navigations,0);
    const after=await page.getByTestId('recipe-card').evaluateAll(cards=>cards.map((card,i)=>({same:card===(window as any).originalCards[i],title:card.querySelector('h4')!.textContent,text:card.textContent})));
    assert(after.every(card=>card.same));assert.deepEqual(after.map(c=>c.title),before.map(c=>c.title));
    for(let i=0;i<after.length;i++)if(after[i].title!=='番茄炒蛋')assert.equal(after[i].text,before[i].text);
    assert(Math.abs(await page.evaluate(()=>scrollY)-beforeY)<3);
    await expect(page.locator('.progress')).toHaveCount(0);
    const geometry=await page.locator('.recipe-grid .recipe-card').evaluateAll(cards=>cards.map(card=>({top:card.getBoundingClientRect().top,height:card.getBoundingClientRect().height,action:card.querySelector('.card-actions')!.getBoundingClientRect().bottom})));
    for(const card of geometry){assert(card.height<600);for(const other of geometry)if(Math.abs(card.top-other.top)<2)assert(Math.abs(card.action-other.action)<2);}
    await page.locator('.recipe-grid').screenshot({path:`${output}/${name}-aligned-cards.png`});
    await tomato.getByRole('button',{name:'看看做法 ↗'}).click();
    await expect(page.getByRole('dialog').locator('.detail-meta')).toContainText(next===options[0]?'咸鲜':'酸甜');
    await page.getByRole('button',{name:'关闭弹层'}).click();
    const restricted={...defaultMeal(),composition:'custom' as const,counts:{meat:2,veg:3,soup:0},ingredients:[inputIngredient('娃娃菜',context)],restrictions:[{id:'fixture-avoid',kind:'avoid' as const,name:'娃娃菜',targets:[context.findFood('娃娃菜')!.id],scope:'self' as const,status:'confirmed' as const,original:'娃娃菜'}]};
    for(const composition of ['custom','auto'] as const){
      await seed({...restricted,composition});await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
      const state=page.locator('.result-state');await expect(state).toContainText('暂时没有合适的搭配');
      assert.doesNotMatch(await state.innerText(),/含有|需避开|原方|未注明|清单中没有|配料信息|娃娃菜/);
      await state.screenshot({path:`${output}/${name}-${composition}-empty.png`});
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    reports.push({foodCategoryPicker:true,variantOnlyUpdatesTargetCard:true,alignedCompactCards:true,emptyMessagesClean:true,name,listY,firstPaint,historyAndBothReturnButtonsRestorePosition:true,sourceTextOnly:true,imagesUncropped:true,singleShoppingDisclosure:true,noHorizontalOverflow:true});
    await page.close();
  }
  await writeFile(`${output}/verification.json`,JSON.stringify(reports,null,2)+'\n');
  console.log(JSON.stringify(reports));
}finally{await browser.close();await app.close();}
