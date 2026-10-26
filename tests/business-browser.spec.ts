import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { defaultMeal } from '../shared/types';
const enabled=process.env.BUSINESS_BROWSER==='1';
test.skip(!enabled,'Requires the isolated local database workflow and business Playwright config');
async function add(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByText('本地构造测试内容：食谱与营养值仅用于功能验证。')).toHaveCount(0);
  await page.getByLabel('手动添加食材',{exact:true}).fill('构造角瓜');
  await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
}
test('数据库专有食材→推荐→步骤/营养→变体→收藏刷新复核',async ({page},info) => {
  await add(page);
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  const card=page.getByTestId('recipe-card');
  await expect(card).toHaveCount(1);await expect(card.getByRole('heading',{name:'构造西葫芦小炒'})).toBeVisible();
  await expect(card.getByText('热量 20 kcal / 整道菜')).toBeVisible();
  await card.getByRole('button',{name:'看看做法'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByText('构造步骤一：核对测试食材。')).toBeVisible();
  await expect(dialog.getByText('钠：暂无法计算',{exact:false})).toBeVisible();
  await expect(dialog.getByText(/营养记录为构造测试值/)).toBeVisible();
  await dialog.getByRole('button',{name:'关闭弹层'}).click();
  await card.getByLabel('构造西葫芦小炒口味').selectOption('local-zucchini-spicy');
  await expect(page.getByTestId('recipe-card').getByText('热量 30 kcal / 整道菜')).toBeVisible();
  await page.getByTestId('recipe-card').getByRole('button',{name:'收藏 构造西葫芦小炒',exact:true}).click();
  await page.reload();await page.getByRole('link',{name:/我的收藏/}).click();
  await page.locator('.saved-recipes').getByRole('button',{name:/构造西葫芦小炒 · 微辣/}).click();
  await expect(page.getByRole('dialog').getByText(/构造微辣步骤/)).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/已按当前食材与饮食要求复查/)).toBeVisible();
  const folder=process.env.ACCEPTANCE_DIR ?? 'acceptance/business-chain';await mkdir(folder,{recursive:true});
  await page.screenshot({path:`${folder}/database-detail-${info.project.name}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('数据库目录首次失败可重试，原草稿保留；不会显示源码备用菜谱',async ({page}) => {
  await page.addInitScript(meal=>localStorage.setItem('shiwei:guest:meal:v1',JSON.stringify(meal)),{...defaultMeal(),raw:'原本输入的构造草稿'});
  let failed=false;
  await page.route('**/api/v1/catalog/recipes',route=>{
    if(!failed){failed=true;return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"CONTENT_DATABASE_UNAVAILABLE"}}'});}
    return route.continue();
  });
  await page.goto('/');await expect(page.getByRole('alert')).toContainText('草稿已保留');
  await expect(page.getByTestId('recipe-card')).toHaveCount(0);
  await page.getByRole('button',{name:'重新读取菜谱'}).click();
  await expect(page.getByText('本地构造测试内容：食谱与营养值仅用于功能验证。')).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shiwei:guest:meal:v1')!).raw)).toBe('原本输入的构造草稿');
});
test('候选不足不凑数；推荐故障不清空输入；过敏过滤仍生效且健康未启用',async ({page}) => {
  await add(page);
  await page.getByLabel('允许补买食材',{exact:false}).check();
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  await expect(page.getByTestId('recipe-card')).toHaveCount(1);
  await page.locator('.preference-shortcuts').getByRole('button',{name:/^过敏/}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('过敏食物',{exact:true}).fill('构造西葫芦');
  await dialog.getByRole('button',{name:'确认添加',exact:true}).click();
  await dialog.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  await expect(page.getByTestId('recipe-card')).toHaveCount(0);
  await page.route('**/api/v1/recommendations',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"CONTENT_DATABASE_UNAVAILABLE","message":"服务暂不可用，输入已保留"}}'}));
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  await expect(page.getByText('服务暂不可用，输入已保留')).toBeVisible();
  await expect(page.getByLabel('构造角瓜用量',{exact:true})).toBeVisible();
  expect((await (await page.request.get('/api/v1/auth/session')).json()).localTestFeatures).toBe(false);
});
test('文字整理采用数据库别名，数据库类别范围须确认后生效',async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'文字输入',exact:true}).click();
  await page.getByLabel('输入食材与本餐信息',{exact:true}).fill('构造角瓜200g');
  await page.getByRole('button',{name:'整理信息 ↗',exact:true}).click();
  await expect(page.getByLabel('构造西葫芦用量',{exact:true})).toHaveValue('200');
  await page.locator('.preference-shortcuts').getByRole('button',{name:/^过敏/}).click();
  await page.getByLabel('过敏食物',{exact:true}).fill('构造瓜类');
  await page.getByRole('button',{name:'确认添加',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('请确认要避开的食物：黄瓜、构造西葫芦');
  await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  await expect(page.getByText('请确认饮食要求：构造瓜类')).toBeVisible();
  await page.locator('.preference-shortcuts').getByRole('button',{name:/^过敏/}).click();
  await page.getByRole('button',{name:'确认避开这些食物',exact:true}).click();
  await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  await expect(page.getByTestId('recipe-card')).toHaveCount(0);
  await expect(page.getByText('暂时没有合适的搭配',{exact:true})).toBeVisible();
});
