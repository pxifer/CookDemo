# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cloudbase-preview.spec.ts >> 云端：逐方核验及忌口拦截，复合调料保持限制
- Location: tests\cloudbase-preview.spec.ts:4:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

Expected: ArrayContaining ["gallery-219f834a020d8a1e", "gallery-7883a9dc2be771ba"]
Received: ["gallery-5ba82d7fefc61d9d", "gallery-6da8ce2aad743d29", "gallery-f1a79c1777840aac", "gallery-7883a9dc2be771ba", "community-qianlong-cabbage", "gallery-f7efe07251205d84"]
```

# Test source

```ts
  1   | import {test,expect} from '@playwright/test';
  2   | import {defaultMeal} from '../shared/types';
  3   | 
  4   | test('云端：逐方核验及忌口拦截，复合调料保持限制',async({page,baseURL})=>{
  5   |   const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  6   |   expect(catalog.contentVersion).toMatch(/-composition-[a-f0-9]{12}$/);
  7   |   const identity=await(await page.request.get('/api/v1/auth/session')).json();
  8   |   const pumpkin=catalog.recipes.find((r:{name:string})=>r.name==='清蒸南瓜'),tomato=catalog.recipes.find((r:{name:string})=>r.name==='糖拌番茄');
  9   |   const run=async(name:string,targets:string[],kind='allergy',selected:{recipeId:string;variantId:string}[]=[])=>{
  10  |     const data={operationId:crypto.randomUUID(),meal:{...defaultMeal(),mode:'candidates',allowBuy:true,restrictions:[{id:'synthetic-composition',name,targets,kind,status:'confirmed',scope:'self',original:'构造限制测试'}]},action:selected.length?'variant':'generate',page:0,selected,previous:[],contentVersion:catalog.contentVersion};
  11  |     const response=await page.request.post('/api/v1/recommendations',{headers:{Origin:baseURL!,'x-csrf-token':identity.csrfToken},data});expect(response.status()).toBe(200);return response.json();
  12  |   };
  13  |   const unrelated=await run('花生',['peanut']);
> 14  |   expect(unrelated.dishes.map((d:{recipe:{id:string}})=>d.recipe.id)).toEqual(expect.arrayContaining([pumpkin.id,tomato.id]));
      |                                                                       ^ Error: expect(received).toEqual(expected) // deep equality
  15  |   expect(unrelated.dishes.every((d:{recipe:{name:string}})=>d.recipe.name!=='乾隆白菜')).toBe(true);
  16  |   const avoidPumpkin=await run('南瓜',[pumpkin.variants[0].lines[0].foodId],'avoid');
  17  |   expect(avoidPumpkin.dishes.every((d:{recipe:{id:string}})=>d.recipe.id!==pumpkin.id)).toBe(true);
  18  |   const avoidSugar=await run('白糖',['sugar'],'avoid');
  19  |   expect(avoidSugar.dishes.every((d:{recipe:{id:string}})=>d.recipe.id!==tomato.id)).toBe(true);
  20  |   const favorite=await run('西红柿',['tomato'],'avoid',[{recipeId:tomato.id,variantId:tomato.variants[0].id}]);
  21  |   expect(favorite.dishes.every((d:{recipe:{id:string}})=>d.recipe.id!==tomato.id)).toBe(true);
  22  | });
  23  | async function visit(page:import('@playwright/test').Page,path:string){
  24  |   await page.goto(path);
  25  |   const confirmation=page.getByRole('button',{name:'确定访问',exact:true});
  26  |   await expect(confirmation.or(page.locator('.site-header'))).toBeVisible();
  27  |   if(await confirmation.isVisible())await confirmation.click();
  28  |   await expect(page.locator('.site-header')).toBeVisible();
  29  | }
  30  | 
  31  | test('云端：手动食材→推荐→图片→做法→收藏刷新，手机和桌面均可用',async({page},info)=>{
  32  |   await visit(page,'/');
  33  |   for(const name of ['白菜','猪肉','粉条']){
  34  |     await page.getByLabel('手动添加食材',{exact:true}).fill(name);
  35  |     await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  36  |   }
  37  |   const pending=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
  38  |   await page.locator('.generate-button').click();expect((await pending).status()).toBe(200);
  39  |   const card=page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'});
  40  |   await expect(card).toBeVisible();await card.scrollIntoViewIfNeeded();
  41  |   await expect(card.locator('img')).toBeVisible();await card.locator('img').evaluate((img:HTMLImageElement)=>img.decode());
  42  |   expect(await card.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  43  |   expect(await card.locator('img').evaluate((img:HTMLImageElement)=>img.currentSrc)).toMatch(/tcloudbaseapp\.com.*\.webp$/);
  44  |   await expect(card).not.toContainText(/无法估算|缺量|暂无法计算/);
  45  |   await card.getByRole('button',{name:'看看做法',exact:false}).click();
  46  |   const modal=page.getByRole('dialog');await expect(modal).toContainText('食材与用量');
  47  |   await modal.getByRole('button',{name:/收藏 白菜猪肉炖粉条/}).click();
  48  |   await page.keyboard.press('Escape');
  49  |   await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:/我的收藏/}).click();
  50  |   await expect(page.locator('.favorite-row')).toHaveCount(1);await page.reload();
  51  |   await expect(page.locator('.favorite-row')).toContainText('白菜猪肉炖粉条');
  52  |   await page.locator('img.favorite-thumb').evaluate((img:HTMLImageElement)=>img.decode());
  53  |   expect(await page.locator('img.favorite-thumb').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  54  |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  55  |   await page.screenshot({path:info.outputPath('favorites-cloud.png'),fullPage:true});
  56  | });
  57  | 
  58  | test('云端：独立图鉴、筛选、刷新和同菜图片可用',async({page},info)=>{
  59  |   await visit(page,'/recipes?q='+encodeURIComponent('清蒸鳜鱼'));
  60  |   await expect(page.locator('.candidate-card')).toHaveCount(1);
  61  |   await expect(page.getByLabel('清蒸鳜鱼口味')).toBeVisible();
  62  |   await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
  63  |   await expect(page.getByRole('heading',{name:'清蒸鳜鱼',exact:true})).toBeVisible();
  64  |   await page.reload();await expect(page.getByRole('heading',{name:'清蒸鳜鱼',exact:true})).toBeVisible();
  65  |   await expect(page.locator('.library-recipe-columns .steps')).toContainText(/蒸/);
  66  |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  67  |   await page.screenshot({path:info.outputPath('gallery-cloud.png'),fullPage:true});
  68  | });
  69  | 
  70  | test('云端：真实内容、HTTPS会话、补买推荐及来源拦截',async({page,baseURL})=>{
  71  |   const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  72  |   expect(catalog.recipes.length).toBe(145);expect(catalog.contentState).toBe('database-candidate');
  73  |   const ready=await page.request.get('/readyz');expect(ready.status()).toBe(200);expect((await ready.json()).status).toBe('preview_ready');
  74  |   const session=await page.request.get('/api/v1/auth/session'),identity=await session.json();
  75  |   expect(session.headers()['set-cookie']).toContain('Secure');expect(identity.accountAvailable).toBe(true);
  76  |   const data={operationId:crypto.randomUUID(),meal:{...defaultMeal(),mode:'candidates',allowBuy:true},action:'generate',page:0,selected:[],previous:[],contentVersion:catalog.contentVersion};
  77  |   const good=await page.request.post('/api/v1/recommendations',{headers:{Origin:baseURL!,'x-csrf-token':identity.csrfToken},data});
  78  |   expect(good.status()).toBe(200);expect((await good.json()).dishes.length).toBe(6);
  79  |   const bad=await page.request.post('/api/v1/recommendations',{headers:{Origin:'https://untrusted.example','x-csrf-token':identity.csrfToken},data});
  80  |   expect([401,403]).toContain(bad.status());
  81  | });
  82  | 
  83  | test('云端：点击下一页会请求并显示下一组菜谱',async({page})=>{
  84  |   test.setTimeout(120000);
  85  |   await visit(page,'/');
  86  |   await page.getByLabel('允许补买食材',{exact:false}).check();
  87  |   const firstResponse=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
  88  |   await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  89  |   expect((await firstResponse).status()).toBe(200);
  90  |   await expect(page.locator('.result-actions span')).toContainText('1 /');
  91  |   const first=await page.locator('.recipe-card h4').allTextContents();
  92  |   await page.route('**/api/v1/recommendations',async route=>{
  93  |     if(route.request().postDataJSON()?.action==='page')await new Promise(resolve=>setTimeout(resolve,1000));
  94  |     await route.continue();
  95  |   });
  96  |   const nextRequest=page.waitForRequest(r=>r.url().endsWith('/api/v1/recommendations'));
  97  |   const nextResponse=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
  98  |   await page.getByRole('button',{name:'下一页',exact:true}).click();
  99  |   const loadingButton=page.getByRole('button',{name:'正在加载第 2 页',exact:true});
  100 |   await expect(loadingButton).toBeDisabled();
  101 |   const request=await nextRequest;
  102 |   const body=request.postDataJSON();
  103 |   expect(body.action).toBe('page');expect(body.page).toBe(1);expect(body.cursor).toBeTruthy();
  104 |   expect((await nextResponse).status()).toBe(200);
  105 |   await expect(page.locator('.result-actions span')).toContainText('2 /');
  106 |   expect(await page.locator('.recipe-card h4').allTextContents()).not.toEqual(first);
  107 | });
  108 | 
```