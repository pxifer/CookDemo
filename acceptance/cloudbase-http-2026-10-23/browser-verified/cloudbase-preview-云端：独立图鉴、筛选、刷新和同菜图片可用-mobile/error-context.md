# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cloudbase-preview.spec.ts >> 云端：独立图鉴、筛选、刷新和同菜图片可用
- Location: tests\cloudbase-preview.spec.ts:34:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.candidate-card')
Expected: 1
Received: 0
Timeout:  18000ms

Call log:
  - Expect "toHaveCount" locator('.candidate-card') with timeout 18000ms
  - waiting for locator('.candidate-card')
    39 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [ref=e18]:
  - generic [ref=e19]:
    - generic [ref=e23]: 页面访问提示
    - generic [ref=e24]: 当前域名 shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com 是由腾讯云 CloudBase 提供的测试域名，仅供开发测试使用，内容可能处于未审核状态请谨慎浏览，请勿泄露个人信息、账号密码或进行涉及财产的操作
  - generic [ref=e25]:
    - generic [ref=e26]:
      - generic [ref=e27]: 环境ID：shiwei-d2gmiun66b7dc6a4f
      - generic [ref=e28]: 页面路径：/recipes?q=%E6%B8%85%E8%92%B8%E9%B3%9C%E9%B1%BC
    - link "我是开发者，如何去掉当前页面？" [ref=e30] [cursor=pointer]:
      - /url: https://docs.cloudbase.net/service/alias#%E5%A6%82%E4%BD%95%E7%A7%BB%E9%99%A4%E4%B8%AD%E9%97%B4%E9%A1%B5
  - button "确定访问" [ref=e32] [cursor=pointer]
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import {defaultMeal} from '../shared/types';
  3  | async function visit(page:import('@playwright/test').Page,path:string){
  4  |   await page.goto(path);
  5  |   const confirmation=page.getByRole('button',{name:'确定访问',exact:true});
  6  |   await expect(confirmation.or(page.locator('.site-header'))).toBeVisible();
  7  |   if(await confirmation.isVisible())await confirmation.click();
  8  |   await expect(page.locator('.site-header')).toBeVisible();
  9  | }
  10 | 
  11 | test('云端：手动食材→推荐→图片→做法→收藏刷新，手机和桌面均可用',async({page},info)=>{
  12 |   await visit(page,'/');
  13 |   for(const name of ['白菜','猪肉','粉条']){
  14 |     await page.getByLabel('手动添加食材',{exact:true}).fill(name);
  15 |     await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  16 |   }
  17 |   const pending=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
  18 |   await page.locator('.generate-button').click();expect((await pending).status()).toBe(200);
  19 |   const card=page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'});
  20 |   await expect(card).toBeVisible();await card.scrollIntoViewIfNeeded();
  21 |   await expect(card.locator('img')).toBeVisible();await card.locator('img').evaluate((img:HTMLImageElement)=>img.decode());
  22 |   expect(await card.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  23 |   expect(await card.locator('img').evaluate((img:HTMLImageElement)=>img.currentSrc)).toMatch(/tcloudbaseapp\.com.*\.webp$/);
  24 |   await expect(card).not.toContainText(/无法估算|缺量|暂无法计算/);
  25 |   await card.getByRole('button',{name:'看看做法',exact:false}).click();
  26 |   const modal=page.getByRole('dialog');await expect(modal).toContainText('食材与用量');
  27 |   await modal.getByRole('button',{name:/收藏 白菜猪肉炖粉条/}).click();
  28 |   await page.keyboard.press('Escape');
  29 |   await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:/我的收藏/}).click();
  30 |   await expect(page.locator('.favorite-row')).toHaveCount(1);await page.reload();
  31 |   await expect(page.locator('.favorite-row')).toContainText('白菜猪肉炖粉条');
  32 |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  33 |   await page.screenshot({path:info.outputPath('favorites-cloud.png'),fullPage:true});
  34 | });
  35 | 
> 36 | test('云端：独立图鉴、筛选、刷新和同菜图片可用',async({page},info)=>{
     |                                                 ^ Error: expect(locator).toHaveCount(expected) failed
  37 |   await visit(page,'/recipes?q='+encodeURIComponent('清蒸鳜鱼'));
  38 |   await expect(page.locator('.candidate-card')).toHaveCount(1);
  39 |   await expect(page.getByLabel('清蒸鳜鱼口味')).toBeVisible();
  40 |   await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
  41 |   await expect(page.getByRole('heading',{name:'清蒸鳜鱼',exact:true})).toBeVisible();
  42 |   await page.reload();await expect(page.getByRole('heading',{name:'清蒸鳜鱼',exact:true})).toBeVisible();
  43 |   await expect(page.locator('.library-recipe-columns .steps')).toContainText(/蒸/);
  44 |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  45 |   await page.screenshot({path:info.outputPath('gallery-cloud.png'),fullPage:true});
  46 | });
  47 | 
  48 | test('云端：真实内容、HTTPS会话、补买推荐及来源拦截',async({page,baseURL})=>{
  49 |   const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  50 |   expect(catalog.recipes.length).toBe(145);expect(catalog.contentState).toBe('database-candidate');
  51 |   const ready=await page.request.get('/readyz');expect(ready.status()).toBe(200);expect((await ready.json()).status).toBe('preview_ready');
  52 |   const session=await page.request.get('/api/v1/auth/session'),identity=await session.json();
  53 |   expect(session.headers()['set-cookie']).toContain('Secure');expect(identity.accountAvailable).toBe(false);
  54 |   const data={operationId:crypto.randomUUID(),meal:{...defaultMeal(),mode:'candidates',allowBuy:true},action:'generate',page:0,selected:[],previous:[],contentVersion:catalog.contentVersion};
  55 |   const good=await page.request.post('/api/v1/recommendations',{headers:{Origin:baseURL!,'x-csrf-token':identity.csrfToken},data});
  56 |   expect(good.status()).toBe(200);expect((await good.json()).dishes.length).toBe(6);
  57 |   const bad=await page.request.post('/api/v1/recommendations',{headers:{Origin:'https://untrusted.example','x-csrf-token':identity.csrfToken},data});
  58 |   expect([401,403]).toContain(bad.status());
  59 | });
  60 | 
```