import {test,expect} from '@playwright/test';
test('鱼和玉米限制：不补买，现有7种食材可推荐；加工配料同样排除',async({page,baseURL},info)=>{
  await page.goto('/');const confirm=page.getByRole('button',{name:'确定访问',exact:true});await expect(confirm.or(page.locator('.site-header'))).toBeVisible();if(await confirm.isVisible())await confirm.click();
  for(const food of ['牛肉','鱼','玉米','白菜','鸡蛋','西红柿','金针菇']){await page.getByLabel('手动添加食材',{exact:true}).fill(food);await page.getByLabel('手动添加食材',{exact:true}).press('Enter');}
  for(const [kind,food] of [['过敏','鱼'],['忌口','玉米']]){
    await page.locator('.preference-shortcuts').getByRole('button',{name:new RegExp(kind)}).click();await page.getByLabel(`${kind}食物`,{exact:true}).fill(food);await page.getByRole('button',{name:'确认添加',exact:true}).click();await page.getByRole('button',{name:'完成',exact:true}).click();
  }
  await expect(page.getByLabel('允许补买食材',{exact:false})).not.toBeChecked();await page.locator('.generate-button').click();
  const cards=page.getByTestId('recipe-card');await expect(cards.first()).toBeVisible();
  const names=await cards.getByRole('heading',{level:4}).allTextContents();expect(names.length).toBeGreaterThan(0);for(const name of names)expect(['金针菇汤','糖拌番茄']).toContain(name);
  await expect(page.getByText('暂时没有合适的搭配',{exact:true})).toHaveCount(0);
  const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();expect(catalog.recipes.length).toBe(145);expect(catalog.relations.length).toBeGreaterThanOrEqual(17);
  const meal=await page.evaluate(()=>JSON.parse(localStorage.getItem('shiwei:guest:meal:v1')!));
  const session=await(await page.request.get('/api/v1/auth/session')).json();
  const result=await page.request.post('/api/v1/recommendations',{headers:{Origin:baseURL!,'x-csrf-token':session.csrfToken,Accept:'application/x-ndjson'},data:{operationId:`composition-v2-public-${info.project.name}`,contentVersion:catalog.contentVersion,meal:{...meal,allowBuy:true,mode:'candidates'},action:'generate',page:0,selected:[],previous:[]}});
  expect(result.status()).toBe(200);const events=(await result.text()).trim().split('\n').map(line=>JSON.parse(line)),completed=events.find(e=>e.type==='result')?.result;
  expect(completed?.status).toBe('completed');for(const dish of completed.dishes)expect(dish.recipe.name).not.toMatch(/鱼|玉米/);
  await cards.first().scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('fish-corn-recommendations.png'),fullPage:true});
});
