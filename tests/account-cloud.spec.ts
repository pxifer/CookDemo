import { test,expect,type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { defaultMeal } from '../shared/types';
const fixturesFile='.local-data/cloudbase-http/account-ingredients-20261024/fixtures.private.json';
async function visit(page:Page,path:string){
  await page.goto(path);
  const confirm=page.getByRole('button',{name:'确定访问',exact:true});
  await expect(confirm.or(page.locator('.site-header'))).toBeVisible();
  if(await confirm.isVisible())await confirm.click();
  await expect(page.locator('.site-header')).toBeVisible();
}
async function login(page:Page,fixture:{name:string;password:string}){
  await visit(page,'/?settings=1');
  await page.getByLabel('用户名',{exact:true}).fill(fixture.name);
  await page.getByLabel('密码',{exact:true}).fill(fixture.password);
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.locator('.account-state')).toContainText(fixture.name);
}

test('卡片：图片显示口味、无序号和成品示意，补买清单默认收起且可展开',async({page},info)=>{
  await visit(page,'/');
  for(const name of ['白菜','猪肉','粉条','鸡蛋']){
    await page.getByLabel('手动添加食材',{exact:true}).fill(name);await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  }
  await page.getByLabel('允许补买食材',{exact:false}).check();
  await page.locator('.generate-button').click();
  const cards=page.getByTestId('recipe-card');await expect(cards).toHaveCount(6);
  await expect(cards.locator('.card-number')).toHaveCount(0);
  await expect(cards.locator('.image-caption').first()).not.toContainText('成品示意');
  const card=cards.filter({has:page.locator('.shopping-list')}).first(),list=card.locator('.shopping-list');
  await expect(list).not.toHaveAttribute('open');
  await expect(list.locator('.checks')).not.toBeVisible();
  await list.locator('summary').click();await expect(list.locator('.checks')).toBeVisible();
  await list.locator('summary').click();await expect(list.locator('.checks')).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const photo of await cards.locator('img').all()){
    await photo.scrollIntoViewIfNeeded();await photo.evaluate((img:HTMLImageElement)=>img.decode());
  }
  await card.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('compact-cards.png'),fullPage:true});
});

test('首次登录：修改初始密码后重新登录，才能保存云端偏好',async({page},info)=>{
  const records=JSON.parse(await readFile('.local-data/cloudbase-http/account-ingredients-20261024/initial-password-fixtures.private.json','utf8'));
  const fixture=records.find((r:any)=>r.project===info.project.name);
  await login(page,{name:fixture.name,password:fixture.initialPassword});
  await expect(page.getByText('首次登录请修改初始密码，再同步个人资料。',{exact:true})).toBeVisible();
  await page.getByLabel('初始密码',{exact:true}).fill(fixture.initialPassword);
  await page.getByLabel('新密码',{exact:true}).fill(fixture.password);
  await page.getByLabel('再次输入新密码',{exact:true}).fill(fixture.password);
  await page.getByRole('button',{name:'修改密码',exact:true}).click();
  await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
  await page.getByLabel('用户名',{exact:true}).fill(fixture.name);
  await page.getByLabel('密码',{exact:true}).fill(fixture.password);
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.locator('.account-state')).toContainText(fixture.name);
  await expect(page.getByRole('button',{name:'立即同步',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'保存为常用偏好',exact:true})).toHaveCount(0);
  await expect.poll(async()=>{const value=await(await page.request.get('/api/v1/account/state')).json();return value.value.defaults?.servings;}).toBe(1);
  await page.getByRole('button',{name:'退出登录',exact:true}).click();
  await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
});

test('账户：自动承接、第二设备读取、并发自动合并、账号隔离、退出撤销',async({page,browser,baseURL},info)=>{
  test.setTimeout(180000);
  const fixtures=JSON.parse(await readFile(fixturesFile,'utf8')) as {name:string;password:string}[];
  // Reset only the two synthetic acceptance accounts, through their ordinary CAS API.
  const initial=await page.request.get('/api/v1/auth/session');let csrf=(await initial.json()).csrfToken;
  for(const fixture of fixtures){
    await page.request.post('/api/v1/auth/login',{headers:{Origin:baseURL!,'x-csrf-token':csrf},data:{username:fixture.name,password:fixture.password}});
    const current=await(await page.request.get('/api/v1/account/state')).json();
    await page.request.post('/api/v1/account/state',{headers:{Origin:baseURL!,'x-csrf-token':csrf},data:{expectedVersion:current.version,value:{favorites:[],defaults:null}}});
    await page.request.post('/api/v1/auth/logout',{headers:{Origin:baseURL!,'x-csrf-token':csrf},data:{}});
  }
  const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json(),first=catalog.recipes.find((r:any)=>r.name==='冬瓜酿肉');
  await visit(page,'/');
  await page.evaluate(({favorite,defaults})=>{
    localStorage.setItem('shiwei:guest:favorites:v1',JSON.stringify([favorite]));
    localStorage.setItem('shiwei:guest:defaults:v1',JSON.stringify(defaults));
  },{favorite:{recipeId:first.id,variantId:first.variants[0].id},defaults:{...defaultMeal(),restrictions:[{id:'test-peanut',kind:'allergy',name:'花生',targets:['peanut'],scope:'self',status:'confirmed',original:'构造验收花生过敏'}]}});
  await login(page,fixtures[0]);
  await expect(page.locator('.sync-review')).toHaveCount(0);
  await visit(page,'/recipes?q='+encodeURIComponent('冬瓜酿肉'));
  const other=await browser.newContext({baseURL,viewport:page.viewportSize()!,locale:'zh-CN'}),b=await other.newPage();
  const third=await browser.newContext({baseURL,viewport:page.viewportSize()!,locale:'zh-CN'}),c=await third.newPage();
  try{
    await login(b,fixtures[0]);
    const secondState=await(await b.request.get('/api/v1/account/state')).json();
    expect(secondState.value.favorites).toHaveLength(1);expect(secondState.value.defaults.restrictions[0].name).toBe('花生');
    await visit(b,'/recipes?q='+encodeURIComponent('上汤娃娃菜'));
    const removed=page.waitForResponse(r=>r.url().endsWith('/api/v1/account/state')&&r.request().method()==='POST');
    await page.locator('.candidate-card').getByRole('button',{name:/取消收藏/}).click();expect((await removed).status()).toBe(200);
    const conflict=b.waitForResponse(r=>r.url().endsWith('/api/v1/account/state')&&r.request().method()==='POST');
    await b.locator('.candidate-card').getByRole('button',{name:/^收藏 /}).click();expect([200,409]).toContain((await conflict).status());
    await expect.poll(async()=>{const data=await(await b.request.get('/api/v1/account/state')).json();return data.value.favorites.length;}).toBe(1);
    await expect(b.locator('.sync-review')).toHaveCount(0);
    await login(c,fixtures[1]);
    const isolated=await(await c.request.get('/api/v1/account/state')).json();expect(isolated.value.favorites).toHaveLength(0);expect(isolated.value.defaults.restrictions).toEqual([]);
    await page.goto('/?settings=1');await expect(page.locator('.account-state')).toBeVisible();
    await page.getByRole('button',{name:'退出登录',exact:true}).click();
    await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
    expect((await page.request.get('/api/v1/account/state')).status()).toBe(401);
    await b.screenshot({path:info.outputPath('account-sync.png'),fullPage:true});
  }finally{await other.close();await third.close();}
});
