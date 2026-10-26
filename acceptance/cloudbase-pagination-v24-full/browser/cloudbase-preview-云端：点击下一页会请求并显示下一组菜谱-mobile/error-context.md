# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cloudbase-preview.spec.ts >> 云端：点击下一页会请求并显示下一组菜谱
- Location: tests\cloudbase-preview.spec.ts:84:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.result-actions span')
Expected substring: "2 /"
Received string:    "1 / 25"
Timeout: 18000ms

Call log:
  - Expect "toContainText" locator('.result-actions span') with timeout 18000ms
  - waiting for locator('.result-actions span')
    39 × locator resolved to <span>1 / 25</span>
       - unexpected value "1 / 25"

```

```yaml
- text: 1 / 25
```

# Test source

```ts
  6   |   const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  7   |   expect(catalog.contentVersion).toContain('-composition-'+compositionRelease.hash.slice(0,12));
  8   |   const identity=await(await page.request.get('/api/v1/auth/session')).json();
  9   |   const pumpkin=catalog.recipes.find((r:{name:string})=>r.name==='清蒸南瓜'),tomato=catalog.recipes.find((r:{name:string})=>r.name==='糖拌番茄');
  10  |   const run=async(name:string,targets:string[],kind='allergy',selected:{recipeId:string;variantId:string}[]=[])=>{
  11  |     const data={operationId:crypto.randomUUID(),meal:{...defaultMeal(),mode:'candidates',allowBuy:true,restrictions:[{id:'synthetic-composition',name,targets,kind,status:'confirmed',scope:'self',original:'构造限制测试'}]},action:selected.length?'variant':'generate',page:0,selected,previous:[],contentVersion:catalog.contentVersion};
  12  |     const response=await page.request.post('/api/v1/recommendations',{headers:{Origin:baseURL!,'x-csrf-token':identity.csrfToken},data});expect(response.status()).toBe(200);return response.json();
  13  |   };
  14  |   const unrelated=await run('花生',['peanut']);
  15  |   expect(unrelated.dishes.map((d:{recipe:{id:string}})=>d.recipe.id)).toEqual(expect.arrayContaining([pumpkin.id,tomato.id]));
  16  |   expect(unrelated.dishes.every((d:{recipe:{name:string}})=>d.recipe.name!=='乾隆白菜')).toBe(true);
  17  |   const avoidPumpkin=await run('南瓜',[pumpkin.variants[0].lines[0].foodId],'avoid');
  18  |   expect(avoidPumpkin.dishes.every((d:{recipe:{id:string}})=>d.recipe.id!==pumpkin.id)).toBe(true);
  19  |   const avoidSugar=await run('白糖',['sugar'],'avoid');
  20  |   expect(avoidSugar.dishes.every((d:{recipe:{id:string}})=>d.recipe.id!==tomato.id)).toBe(true);
  21  |   const favorite=await run('西红柿',['tomato'],'avoid',[{recipeId:tomato.id,variantId:tomato.variants[0].id}]);
  22  |   expect(favorite.dishes.every((d:{recipe:{id:string}})=>d.recipe.id!==tomato.id)).toBe(true);
  23  | });
  24  | async function visit(page:import('@playwright/test').Page,path:string){
  25  |   await page.goto(path);
  26  |   const confirmation=page.getByRole('button',{name:'确定访问',exact:true});
  27  |   await expect(confirmation.or(page.locator('.site-header'))).toBeVisible();
  28  |   if(await confirmation.isVisible())await confirmation.click();
  29  |   await expect(page.locator('.site-header')).toBeVisible();
  30  | }
  31  | 
  32  | test('云端：手动食材→推荐→图片→做法→收藏刷新，手机和桌面均可用',async({page},info)=>{
  33  |   await visit(page,'/');
  34  |   for(const name of ['白菜','猪肉','粉条']){
  35  |     await page.getByLabel('手动添加食材',{exact:true}).fill(name);
  36  |     await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  37  |   }
  38  |   const pending=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
  39  |   await page.locator('.generate-button').click();expect((await pending).status()).toBe(200);
  40  |   const card=page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'});
  41  |   await expect(card).toBeVisible();await card.scrollIntoViewIfNeeded();
  42  |   await expect(card.locator('img')).toBeVisible();await card.locator('img').evaluate((img:HTMLImageElement)=>img.decode());
  43  |   expect(await card.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  44  |   expect(await card.locator('img').evaluate((img:HTMLImageElement)=>img.currentSrc)).toMatch(/tcloudbaseapp\.com.*\.webp$/);
  45  |   await expect(card).not.toContainText(/无法估算|缺量|暂无法计算/);
  46  |   await card.getByRole('button',{name:'看看做法',exact:false}).click();
  47  |   const modal=page.getByRole('dialog');await expect(modal).toContainText('食材与用量');
  48  |   await modal.getByRole('button',{name:/收藏 白菜猪肉炖粉条/}).click();
  49  |   await page.keyboard.press('Escape');
  50  |   await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:/我的收藏/}).click();
  51  |   await expect(page.locator('.favorite-row')).toHaveCount(1);await page.reload();
  52  |   await expect(page.locator('.favorite-row')).toContainText('白菜猪肉炖粉条');
  53  |   await page.locator('img.favorite-thumb').evaluate((img:HTMLImageElement)=>img.decode());
  54  |   expect(await page.locator('img.favorite-thumb').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  55  |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  56  |   await page.screenshot({path:info.outputPath('favorites-cloud.png'),fullPage:true});
  57  | });
  58  | 
  59  | test('云端：独立图鉴、筛选、刷新和同菜图片可用',async({page},info)=>{
  60  |   await visit(page,'/recipes?q='+encodeURIComponent('清蒸鳜鱼'));
  61  |   await expect(page.locator('.candidate-card')).toHaveCount(1);
  62  |   await expect(page.getByLabel('清蒸鳜鱼口味')).toBeVisible();
  63  |   await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
  64  |   await expect(page.getByRole('heading',{name:'清蒸鳜鱼',exact:true})).toBeVisible();
  65  |   await page.reload();await expect(page.getByRole('heading',{name:'清蒸鳜鱼',exact:true})).toBeVisible();
  66  |   await expect(page.locator('.library-recipe-columns .steps')).toContainText(/蒸/);
  67  |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  68  |   await page.screenshot({path:info.outputPath('gallery-cloud.png'),fullPage:true});
  69  | });
  70  | 
  71  | test('云端：真实内容、HTTPS会话、补买推荐及来源拦截',async({page,baseURL})=>{
  72  |   const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  73  |   expect(catalog.recipes.length).toBe(145);expect(catalog.contentState).toBe('database-candidate');
  74  |   const ready=await page.request.get('/readyz');expect(ready.status()).toBe(200);expect((await ready.json()).status).toBe('preview_ready');
  75  |   const session=await page.request.get('/api/v1/auth/session'),identity=await session.json();
  76  |   expect(session.headers()['set-cookie']).toContain('Secure');expect(identity.accountAvailable).toBe(true);
  77  |   const data={operationId:crypto.randomUUID(),meal:{...defaultMeal(),mode:'candidates',allowBuy:true},action:'generate',page:0,selected:[],previous:[],contentVersion:catalog.contentVersion};
  78  |   const good=await page.request.post('/api/v1/recommendations',{headers:{Origin:baseURL!,'x-csrf-token':identity.csrfToken},data});
  79  |   expect(good.status()).toBe(200);expect((await good.json()).dishes.length).toBe(6);
  80  |   const bad=await page.request.post('/api/v1/recommendations',{headers:{Origin:'https://untrusted.example','x-csrf-token':identity.csrfToken},data});
  81  |   expect([401,403]).toContain(bad.status());
  82  | });
  83  | 
  84  | test('云端：点击下一页会请求并显示下一组菜谱',async({page})=>{
  85  |   test.setTimeout(120000);
  86  |   await visit(page,'/');
  87  |   await page.getByLabel('允许补买食材',{exact:false}).check();
  88  |   const firstResponse=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
  89  |   await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  90  |   expect((await firstResponse).status()).toBe(200);
  91  |   await expect(page.locator('.result-actions span')).toContainText('1 /');
  92  |   const first=await page.locator('.recipe-card h4').allTextContents();
  93  |   await page.route('**/api/v1/recommendations',async route=>{
  94  |     if(route.request().postDataJSON()?.action==='page')await new Promise(resolve=>setTimeout(resolve,1000));
  95  |     await route.continue();
  96  |   });
  97  |   const nextRequest=page.waitForRequest(r=>r.url().endsWith('/api/v1/recommendations'));
  98  |   const nextResponse=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
  99  |   await page.getByRole('button',{name:'下一页',exact:true}).click();
  100 |   const loadingButton=page.getByRole('button',{name:'正在加载第 2 页',exact:true});
  101 |   await expect(loadingButton).toBeDisabled();
  102 |   const request=await nextRequest;
  103 |   const body=request.postDataJSON();
  104 |   expect(body.action).toBe('page');expect(body.page).toBe(1);expect(body.cursor).toBeTruthy();
  105 |   expect((await nextResponse).status()).toBe(200);
> 106 |   await expect(page.locator('.result-actions span')).toContainText('2 /');
      |                                                      ^ Error: expect(locator).toContainText(expected) failed
  107 |   expect(await page.locator('.recipe-card h4').allTextContents()).not.toEqual(first);
  108 | });
  109 | 
```