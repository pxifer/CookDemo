import {test,expect} from '@playwright/test';
import {defaultMeal} from '../shared/types';

test('云端：逐方核验及忌口拦截，复合调料保持限制',async({page,baseURL})=>{
  const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  expect(catalog.contentVersion).toMatch(/-composition-[a-f0-9]{12}$/);
  const identity=await(await page.request.get('/api/v1/auth/session')).json();
  const pumpkin=catalog.recipes.find((r:{name:string})=>r.name==='清蒸南瓜'),tomato=catalog.recipes.find((r:{name:string})=>r.name==='糖拌番茄');
  const run=async(name:string,targets:string[],kind='allergy',selected:{recipeId:string;variantId:string}[]=[])=>{
    const data={operationId:crypto.randomUUID(),meal:{...defaultMeal(),mode:selected.length?'meal':'candidates',allowBuy:true,restrictions:[{id:'synthetic-composition',name,targets,kind,status:'confirmed',scope:'self',original:'构造限制测试'}]},action:selected.length?'variant':'generate',page:0,selected,previous:[],contentVersion:catalog.contentVersion};
    const response=await page.request.post('/api/v1/recommendations',{headers:{Origin:baseURL!,'x-csrf-token':identity.csrfToken},data});expect(response.status()).toBe(200);return response.json();
  };
  const unrelated=await run('花生',['peanut'],'allergy',[{recipeId:pumpkin.id,variantId:pumpkin.variants[0].id},{recipeId:tomato.id,variantId:tomato.variants[0].id}]);
  expect(unrelated.dishes.map((d:{recipe:{id:string}})=>d.recipe.id)).toEqual(expect.arrayContaining([pumpkin.id,tomato.id]));
  expect(unrelated.dishes.every((d:{recipe:{name:string}})=>d.recipe.name!=='乾隆白菜')).toBe(true);
  const avoidPumpkin=await run('南瓜',[pumpkin.variants[0].lines[0].foodId],'avoid');
  expect(avoidPumpkin.dishes.every((d:{recipe:{id:string}})=>d.recipe.id!==pumpkin.id)).toBe(true);
  const avoidSugar=await run('白糖',['sugar'],'avoid');
  expect(avoidSugar.dishes.every((d:{recipe:{id:string}})=>d.recipe.id!==tomato.id)).toBe(true);
  const favorite=await run('西红柿',['tomato'],'avoid',[{recipeId:tomato.id,variantId:tomato.variants[0].id}]);
  expect(favorite.dishes.every((d:{recipe:{id:string}})=>d.recipe.id!==tomato.id)).toBe(true);
});
async function visit(page:import('@playwright/test').Page,path:string){
  await page.goto(path);
  const confirmation=page.getByRole('button',{name:'确定访问',exact:true});
  await expect(confirmation.or(page.locator('.site-header'))).toBeVisible();
  if(await confirmation.isVisible())await confirmation.click();
  await expect(page.locator('.site-header')).toBeVisible();
}

test('云端：手动食材→推荐→图片→做法→收藏刷新，手机和桌面均可用',async({page},info)=>{
  await visit(page,'/');
  for(const name of ['白菜','猪肉','粉条']){
    await page.getByLabel('手动添加食材',{exact:true}).fill(name);
    await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  }
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
  await page.locator('.generate-button').click();expect((await pending).status()).toBe(200);
  const card=page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'});
  await expect(card).toBeVisible();await card.scrollIntoViewIfNeeded();
  await expect(card.locator('img')).toBeVisible();await card.locator('img').evaluate((img:HTMLImageElement)=>img.decode());
  expect(await card.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  expect(await card.locator('img').evaluate((img:HTMLImageElement)=>img.currentSrc)).toMatch(/tcloudbaseapp\.com.*\.webp$/);
  await expect(card).not.toContainText(/无法估算|缺量|暂无法计算/);
  await card.getByRole('button',{name:'看看做法',exact:false}).click();
  const modal=page.getByRole('dialog');await expect(modal).toContainText('食材与用量');
  await modal.getByRole('button',{name:/收藏 白菜猪肉炖粉条/}).click();
  await page.keyboard.press('Escape');
  await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:/我的收藏/}).click();
  await expect(page.locator('.favorite-row')).toHaveCount(1);await page.reload();
  await expect(page.locator('.favorite-row')).toContainText('白菜猪肉炖粉条');
  await page.locator('img.favorite-thumb').evaluate((img:HTMLImageElement)=>img.decode());
  expect(await page.locator('img.favorite-thumb').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('favorites-cloud.png'),fullPage:true});
});

test('云端：独立图鉴、筛选、刷新和同菜图片可用',async({page},info)=>{
  await visit(page,'/recipes?q='+encodeURIComponent('清蒸鳜鱼'));
  await expect(page.locator('.candidate-card')).toHaveCount(1);
  await expect(page.getByLabel('清蒸鳜鱼口味')).toBeVisible();
  await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
  await expect(page.getByRole('heading',{name:'清蒸鳜鱼',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'清蒸鳜鱼',exact:true})).toBeVisible();
  await expect(page.locator('.library-recipe-columns .steps')).toContainText(/蒸/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('gallery-cloud.png'),fullPage:true});
});

test('云端：真实内容、HTTPS会话、补买推荐及来源拦截',async({page,baseURL})=>{
  const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  expect(catalog.recipes.length).toBe(145);expect(catalog.contentState).toBe('database-candidate');
  const ready=await page.request.get('/readyz');expect(ready.status()).toBe(200);expect((await ready.json()).status).toBe('preview_ready');
  const session=await page.request.get('/api/v1/auth/session'),identity=await session.json();
  expect(session.headers()['set-cookie']).toContain('Secure');expect(identity.accountAvailable).toBe(true);
  const data={operationId:crypto.randomUUID(),meal:{...defaultMeal(),mode:'candidates',allowBuy:true},action:'generate',page:0,selected:[],previous:[],contentVersion:catalog.contentVersion};
  const good=await page.request.post('/api/v1/recommendations',{headers:{Origin:baseURL!,'x-csrf-token':identity.csrfToken},data});
  expect(good.status()).toBe(200);expect((await good.json()).dishes.length).toBe(6);
  const bad=await page.request.post('/api/v1/recommendations',{headers:{Origin:'https://untrusted.example','x-csrf-token':identity.csrfToken},data});
  expect([401,403]).toContain(bad.status());
});

test('云端：点击下一页会请求并显示下一组菜谱',async({page})=>{
  test.setTimeout(120000);
  await visit(page,'/');
  await page.getByLabel('允许补买食材',{exact:false}).check();
  const firstResponse=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  expect((await firstResponse).status()).toBe(200);
  await expect(page.locator('.result-actions span')).toContainText('1 /');
  const first=await page.locator('.recipe-card h4').allTextContents();
  await page.route('**/api/v1/recommendations',async route=>{
    if(route.request().postDataJSON()?.action==='page')await new Promise(resolve=>setTimeout(resolve,1000));
    await route.continue();
  });
  const nextRequest=page.waitForRequest(r=>r.url().endsWith('/api/v1/recommendations'));
  const nextResponse=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
  await page.getByRole('button',{name:'下一页',exact:true}).click();
  const loadingButton=page.getByRole('button',{name:'正在加载第 2 页',exact:true});
  await expect(loadingButton).toBeDisabled();
  const request=await nextRequest;
  const body=request.postDataJSON();
  expect(body.action).toBe('page');expect(body.page).toBe(1);expect(body.cursor).toBeTruthy();
  expect((await nextResponse).status()).toBe(200);
  await expect(page.locator('.result-actions span')).toContainText('2 /');
  expect(await page.locator('.recipe-card h4').allTextContents()).not.toEqual(first);
});

test('云端：145道菜均有独立可解码图片，图鉴与工作台映射一致',async({page})=>{
  test.setTimeout(120000);await visit(page,'/');
  const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  const gallery=await(await page.request.get('/api/v1/local/candidate-recipes')).json();
  expect(catalog.recipes).toHaveLength(145);
  expect(new Set(catalog.recipes.map((recipe:any)=>recipe.imageUrl)).size).toBe(145);
  for(const recipe of catalog.recipes){
    expect(recipe.imageUrl).toMatch(/tcloudbaseapp\.com\/assets\/recipes\/.+\.png$/);
    expect(gallery.recipes.filter((row:any)=>row.dish_key===recipe.name).every((row:any)=>row.image_url===recipe.imageUrl)).toBe(true);
  }
  const decoded=await page.evaluate(async(urls:string[])=>{
    const failures:string[]=[];let position=0;
    await Promise.all(Array.from({length:6},async()=>{
      while(position<urls.length){const url=urls[position++];const image=new Image();image.src=url;try{await image.decode();if(!image.naturalWidth)failures.push(url);}catch{failures.push(url);}}
    }));return{count:urls.length,failures};
  },catalog.recipes.map((recipe:any)=>recipe.imageUrl.replace(/\.png$/,'.webp')));
  expect(decoded).toEqual({count:145,failures:[]});
});

test('云端：换一道只更换当前卡片，其他位置与滚动保持',async({page})=>{
  test.setTimeout(120000);await visit(page,'/');
  for(const name of ['鸡蛋','猪肉','白菜','粉条','西红柿','土豆']){
    await page.getByLabel('手动添加食材',{exact:true}).fill(name);await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  }
  await page.locator('.generate-button').click();
  const cards=page.getByTestId('recipe-card');await expect(cards.first()).toBeVisible();
  await expect(page.locator('.generate-button')).toBeEnabled();
  const before=await cards.locator('h4').allTextContents();expect(before.length).toBeGreaterThanOrEqual(3);
  const index=Math.floor(before.length/2),target=page.getByRole('button',{name:`替换 ${before[index]}`,exact:true});
  await page.route('**/api/v1/recommendations',async route=>{if(route.request().postDataJSON()?.action==='replace')await new Promise(resolve=>setTimeout(resolve,800));await route.continue();});
  await target.scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);
  await target.click();await expect(target).toBeDisabled();await expect(target).toHaveText('正在换菜…');await expect(page.locator('.progress')).toHaveCount(0);
  await expect(cards.locator('h4').nth(index)).not.toHaveText(before[index]);
  const after=await cards.locator('h4').allTextContents();expect(after).toHaveLength(before.length);
  for(let slot=0;slot<before.length;slot++)if(slot!==index)expect(after[slot]).toBe(before[slot]);
  expect(Math.abs(await page.evaluate(()=>scrollY)-scroll)).toBeLessThan(70);
});
