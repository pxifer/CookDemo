import { test, expect, type Page } from './local-browser';
import {addManualFood,openSavedRecipe,recommendationAfter} from './ui-helpers';
const ingredients = '鸡肉300g香菇200g西红柿500g鸡蛋4个土豆500g菠菜300g西兰花300g黄瓜300g';
async function parse(page: Page, text: string) {
  await page.getByRole('button', { name: '文字输入', exact: true }).click();
  await page.getByLabel('输入食材与本餐信息', { exact: true }).fill(text);
  await page.getByRole('button', { name: '整理信息 ↗', exact: true }).click();
  await expect(page.locator('.notice')).toBeVisible();
}
async function generate(page: Page) {
  const button = page.getByRole('button', { name: '安排这一餐', exact: true });
  await button.click(); await expect(button).toBeEnabled();
}
async function chooseCounts(page: Page, meat: number, veg: number, soup: number) {
  await page.getByRole('button', { name: '按荤素汤', exact: true }).click();
  await page.getByLabel('荤菜道数', { exact: true }).selectOption(String(meat));
  await page.getByLabel('素菜道数', { exact: true }).selectOption(String(veg));
  await page.getByLabel('汤品道数', { exact: true }).selectOption(String(soup));
}
async function settings(page: Page, kind: '过敏' | '忌口' | '调料') {
  await page.locator('.preference-shortcuts').getByRole('button', { name: new RegExp(`^${kind}`) }).click();
  await expect(page.getByRole('dialog', { name: `${kind}设置` })).toBeVisible();
}
async function addRestriction(page: Page, kind: '过敏' | '忌口', text: string, additional = false) {
  await settings(page, kind);
  await page.getByLabel('为谁设置', { exact: true }).selectOption(additional ? 'additional' : 'self');
  await page.getByLabel(`${kind}食物`, { exact: true }).fill(text);
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
}
test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.getByRole('heading', { name: '看看有什么食材' })).toBeVisible(); });

test('本机构造身份：直接登录、无账户Key不能启用AI，普通推荐不调用模型', async ({ page }, info) => {
  let chatRequests = 0;
  await page.route('**/api/v1/health/chat', async route => {
    chatRequests++;const body=route.request().postDataJSON();
    await route.fulfill({status:200,json:{operationId:body.operationId,message:{role:'assistant',content:'构造饮食参考回复'},knowledge:'general_model'}});
  });
  await parse(page, ingredients);
  await page.getByRole('button', { name: /健康模式/ }).click();
  await expect(page.getByRole('dialog',{name:'登录',exact:true})).toBeVisible();
  await page.getByRole('button', { name: '登录测试账号', exact: true }).click();
  await expect(page.locator('.account-state')).toContainText('本机测试账号');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/健康模式/}).click();await expect(page.getByRole('dialog',{name:'个人设置',exact:true})).toBeVisible();
  await expect(page.getByLabel('DeepSeek API Key',{exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
  const chat=page.getByRole('region',{name:'健康AI对话',exact:true});
  await expect(chat).toHaveCount(0);await expect(page.locator('.health-entry .switch')).not.toHaveClass(/on/);
  await generate(page);await expect(page.getByTestId('recipe-card')).toHaveCount(6);expect(chatRequests).toBe(0);
  await page.screenshot({path:`${process.env.ACCEPTANCE_DIR??'acceptance'}/${info.project.name}-local-identity-gate.png`});
});

test('D7-04新口径: 食材自动使用且不显示用量，重复带量输入不重算、刷新保留名称', async ({ page }) => {
  await parse(page, '西红柿2个鸡蛋3个菠菜一把');
  await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'鸡蛋'})).toBeVisible(); await expect(page.getByLabel('鸡蛋用量',{exact:true})).toHaveCount(0);
  await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'鸡蛋'})).toBeVisible(); await expect(page.getByLabel('鸡蛋单位',{exact:true})).toHaveCount(0);
  await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'菠菜'})).toBeVisible(); await expect(page.getByLabel('菠菜用量',{exact:true})).toHaveCount(0);
  await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'菠菜'})).toBeVisible(); await expect(page.getByLabel('菠菜单位',{exact:true})).toHaveCount(0);
  await generate(page); await expect(page.getByTestId('recipe-card').first()).toBeVisible();
  const cards=await page.getByTestId('recipe-card').allTextContents();let requests=0;
  page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/v1/recommendations'))requests++;});
  await parse(page, '鸡蛋5个');
  await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'鸡蛋'})).toBeVisible(); await expect(page.getByLabel('鸡蛋用量',{exact:true})).toHaveCount(0);
  await expect(page.getByText(/已有用量.*这次用哪个/)).toHaveCount(0);
  expect(await page.getByTestId('recipe-card').allTextContents()).toEqual(cards);
  await parse(page, '鸡蛋99999g');
  expect(await page.getByTestId('recipe-card').allTextContents()).toEqual(cards);expect(requests).toBe(0);
  await page.reload();await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'鸡蛋'})).toBeVisible(); await expect(page.getByLabel('鸡蛋用量',{exact:true})).toHaveCount(0);
  await generate(page);await expect(page.getByTestId('recipe-card').first()).toBeVisible();
});

test('D7-04: 手动添加不用确认且不显示用量，清单不混入调料', async ({ page }) => {
  await addManualFood(page,'土豆');
  await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'土豆'})).toBeVisible(); await expect(page.getByLabel('土豆用量',{exact:true})).toHaveCount(0);
  await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'土豆'})).toBeVisible(); await expect(page.getByLabel('土豆单位',{exact:true})).toHaveCount(0);

  await page.reload(); await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'土豆'})).toBeVisible(); await expect(page.getByLabel('土豆单位',{exact:true})).toHaveCount(0);
  await parse(page, '土豆99999g');
  await generate(page); await expect(page.getByTestId('recipe-card').first()).toBeVisible();
  await addManualFood(page,'盐');
  await expect(page.getByLabel('盐用量', { exact: true })).toHaveCount(0);
  expect(await page.locator('#food-names option').evaluateAll(es => es.map(e => (e as HTMLOptionElement).value))).not.toContain('盐');
  await expect(page.getByRole('button', { name: /确认已知食材|用示例|多菜候选/ })).toHaveCount(0);
});

test('B01 / D7-05: 过敏与忌口分开输入、类别范围确认、未知限制阻断', async ({ page }, info) => {
  await parse(page, '鸡蛋3个西红柿500g虾300g');
  await addRestriction(page, '过敏', '海产品');
  await expect(page.getByLabel('忌口食物', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('鱼、虾');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await generate(page); await expect(page.getByText('请确认饮食要求：海产品')).toBeVisible();
  await settings(page, '过敏'); await page.getByRole('button', { name: '确认避开这些食物', exact: true }).click();
  await page.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-allergy.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByLabel('允许补买食材', { exact: false }).check(); await generate(page);
  await expect(page.getByTestId('recipe-card').filter({ hasText: '虾仁滑蛋' })).toHaveCount(0);
  await addRestriction(page, '忌口', '未识别食物'); await page.keyboard.press('Escape');
  await generate(page); await expect(page.getByText('请确认饮食要求：未识别食物')).toBeVisible();
});

test('D7-05: 同餐人限制默认不加入，主动勾选才生效', async ({ page }) => {
  await parse(page, '鸡蛋4个西红柿500g虾300g');
  await addRestriction(page, '忌口', '鸡蛋', true); await page.keyboard.press('Escape');
  await page.getByLabel('允许补买食材', { exact: false }).check();
  await generate(page); await expect(page.getByTestId('recipe-card').filter({ hasText: '番茄炒蛋' })).toHaveCount(1);
  await settings(page, '忌口'); await page.getByLabel('这顿饭也照顾同行人的过敏和忌口').check(); await page.keyboard.press('Escape');
  await generate(page); await expect(page.getByTestId('recipe-card').filter({ hasText: '番茄炒蛋' })).toHaveCount(0);
});

test('D7-06: 调料和补买分开，补买切换候选并可翻页，关闭仍按食材浏览', async ({ page }) => {
  await parse(page, ingredients);
  await settings(page, '调料'); await expect(page.getByRole('dialog')).not.toContainText('允许补买');
  await page.getByLabel('只使用家里现有的调料').check(); await page.getByRole('checkbox', { name: '生抽', exact: true }).uncheck();
  await page.keyboard.press('Escape'); await page.getByLabel('允许补买食材', { exact: false }).check();
  await expect(page.locator('.recommendation-mode strong')).toHaveText('不限数量');
  await generate(page); await expect(page.getByTestId('recipe-card')).toHaveCount(6);
  const first = await page.getByTestId('recipe-card').locator('h4').allTextContents();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.getByRole('button', { name: '上一页', exact: true })).toBeEnabled();
  expect(await page.getByTestId('recipe-card').locator('h4').allTextContents()).not.toEqual(first);
  await page.getByLabel('允许补买食材', { exact: false }).uncheck();
  await expect(page.locator('.recommendation-mode strong')).toHaveText('不限数量');
  await generate(page); await expect(page.getByTestId('recipe-card').first()).toBeVisible();
});

test('B02 / D16-03: 游客个人设置仅本机，刷新和新一餐保留设置', async ({ page }) => {
  await parse(page, '鸡蛋2个'); await addRestriction(page, '过敏', '对虾'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '个人设置', exact: true }).click();
  await expect(page.getByRole('button',{name:'保存为常用偏好',exact:true})).toHaveCount(0); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '微辣', exact: true }).click();
  await page.reload(); await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'鸡蛋'})).toBeVisible(); await expect(page.getByLabel('鸡蛋用量',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button', { name: '微辣', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '开始新一餐 ↻', exact: true }).click();
  await expect(page.getByLabel('鸡蛋用量', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '微辣', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await settings(page, '过敏'); await expect(page.getByRole('dialog')).toContainText('对虾');
});

test('AC-18/19/20/21: 单换保留其他菜、变体详情、收藏刷新复查', async ({ page }, info) => {
  await parse(page, ingredients); await chooseCounts(page, 1, 2, 0); await generate(page); await expect(page.getByTestId('recipe-card')).toHaveCount(3);
  const before = await page.getByTestId('recipe-card').locator('h4').allTextContents();
  await page.getByRole('button', { name: `替换 ${before[1]}`, exact: true }).click();
  await expect(page.getByTestId('recipe-card').filter({ hasText: before[1] })).toHaveCount(0);
  const after = await page.getByTestId('recipe-card').locator('h4').allTextContents(); expect(after[0]).toBe(before[0]); expect(after[2]).toBe(before[2]); expect(after[1]).not.toBe(before[1]);
  const first = page.getByTestId('recipe-card').first(), name = await first.locator('h4').innerText();
  const select = first.getByLabel(`${name}口味`),current=await select.inputValue();
  const target=(await select.locator('option').evaluateAll(es=>es.map(e=>({id:(e as HTMLOptionElement).value,label:e.textContent!})))).find(option=>option.id!==current)!;
  expect(target).toBeTruthy();const changed=await recommendationAfter(page,()=>select.selectOption(target.id),'variant');expect(changed.changed).toBe(true);
  const expected=changed.dishes.find(dish=>dish.recipe.name===name)!.variant;expect(expected.id).toBe(target.id);
  await expect(select).toBeEnabled();await expect(select).toHaveValue(target.id);await expect(page.getByTestId('recipe-card')).toHaveCount(3);
  await page.getByTestId('recipe-card').filter({ hasText: name }).getByRole('button', { name: '看看做法', exact: false }).click();
  await expect(page.getByRole('dialog', { name }).locator('.detail-meta')).toContainText(target.label);
  await expect(page.getByRole('dialog').locator('.detail-method-grid section').first().locator('.steps li')).toHaveText(expected.steps);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-meal.png`, fullPage: true });
  await page.getByTestId('recipe-card').filter({ hasText: name }).getByRole('button', { name: `收藏 ${name}`, exact: true }).click();
  await page.reload(); await page.getByRole('link', { name: '我的收藏', exact: false }).click();
  await expect(page.locator('.saved-recipes')).toContainText(name);
  const reopened=await openSavedRecipe(page,name);await expect(reopened.locator('.detail-meta')).toContainText(target.label);
});

test('单换保持卡片位置和当前滚动，加载提示只出现在目标按钮',async({page})=>{
  await parse(page,ingredients);await chooseCounts(page,1,2,0);await generate(page);
  const cards=page.getByTestId('recipe-card');await expect(cards).toHaveCount(3);
  const before=await cards.locator('h4').allTextContents();
  await page.route('**/api/v1/recommendations',async route=>{
    if(route.request().postDataJSON()?.action==='replace')await new Promise(resolve=>setTimeout(resolve,600));
    await route.continue();
  });
  const target=page.getByRole('button',{name:`替换 ${before[1]}`,exact:true});
  await target.scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);
  await target.click();await expect(target).toHaveText('更新中…');await expect(target).toBeDisabled();await expect(target).toHaveAttribute('aria-busy','true');
  await expect(page.locator('.progress')).toHaveCount(0);
  await expect(cards.locator('h4').nth(1)).not.toHaveText(before[1]);
  const after=await cards.locator('h4').allTextContents();
  expect(after[0]).toBe(before[0]);expect(after[2]).toBe(before[2]);
  expect(Math.abs(await page.evaluate(()=>scrollY)-scroll)).toBeLessThan(60);
});

test('B03/B04: 单位不能换算不冒充足量，非法菜数拦截', async ({ page }) => {
  await parse(page, '鸡蛋1g');
  await page.getByLabel('允许补买食材', { exact: false }).check();
  const result=await recommendationAfter(page,()=>generate(page),'generate'),eggs=result.dishes.flatMap(dish=>dish.checks).filter(check=>check.foodId==='egg');
  expect(eggs.length).toBeGreaterThan(0);expect(eggs.every(check=>check.state==='unverified'&&check.shortage===null)).toBe(true);
  await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'鸡蛋'})).toBeVisible(); await expect(page.getByLabel('鸡蛋用量',{exact:true})).toHaveCount(0);await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'鸡蛋'})).toBeVisible(); await expect(page.getByLabel('鸡蛋单位',{exact:true})).toHaveCount(0);
  await expect(page.getByTestId('recipe-card').first()).not.toContainText('用量请参考菜谱');
  await page.getByRole('button', { name: '按荤素汤', exact: true }).click();
  for (const label of ['荤菜道数', '素菜道数', '汤品道数']) await page.getByLabel(label, { exact: true }).selectOption('0');
  await expect(page.getByRole('alert').filter({ hasText: '至少选择 1 道菜' })).toBeVisible();
  await generate(page);
  await expect(page.locator('.notice')).toContainText('合计 1～20 道');
});

test('V-07: 编辑后晚到结果不覆盖，断流不可成功', async ({ page }) => {
  await parse(page, ingredients);
  let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
  let start!: () => void; const started = new Promise<void>(resolve => { start = resolve; });
  let handled!: () => void; const settled = new Promise<void>(resolve => { handled = resolve; });
  await page.route('**/api/v1/recommendations', async route => { start(); const response = await route.fetch(); await wait; try { await route.fulfill({ response }); } catch (error) { if (!(error as Error).message.includes('already handled')) throw error; } finally { handled(); } });
  await page.getByRole('button', { name: '安排这一餐', exact: true }).click();
  await started; await page.getByRole('button', { name: '按荤素汤', exact: true }).click(); release(); await settled; await expect(page.getByTestId('recipe-card')).toHaveCount(0);
  await page.unroute('**/api/v1/recommendations');
  await page.route('**/api/v1/recommendations', route => route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'progress', stage: '输入已校验' }) + '\n' }));
  await generate(page); await expect(page.getByRole('status').filter({ hasText: '结果连接中断' })).toBeVisible(); await expect(page.getByTestId('recipe-card')).toHaveCount(0);
});

test('D7-07: 精简左栏、多尺寸无溢出、弹层焦点、无开发用语及前端错误', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await expect(page.getByRole('heading', { name: /有啥，做啥/ })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/构造数据|开发预览|本机草稿|测试目录|基准未确认|暂不参与推荐|示例食材/);
  await page.getByRole('button', { name: '拍照识别', exact: true }).focus(); await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '文字输入', exact: true })).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('输入食材与本餐信息', { exact: true })).toBeVisible();
  await parse(page, ingredients);
  expect((await page.locator('.ingredients').boundingBox())!.height).toBeLessThanOrEqual(224);
  const pickerHeight=(await page.locator('.food-picker').boundingBox())!.height;
  expect(pickerHeight).toBeLessThanOrEqual(120);
  expect((await page.locator('.input-column').boundingBox())!.height-pickerHeight).toBeLessThan(860);
  for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  if (info.project.name === 'mobile') { await page.locator('.preferences').scrollIntoViewIfNeeded(); await expect(page.locator('.mobile-cta')).toBeVisible(); }
  await page.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-compact.png`, fullPage: true });
  await settings(page, '忌口'); await page.keyboard.press('Escape');
  await expect(page.locator('.preference-shortcuts').getByRole('button', { name: /^忌口/ })).toBeFocused();
  await page.getByRole('button', { name: /健康模式/ }).click(); await expect(page.getByRole('dialog',{name:'登录',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('AR-M03: 跨页面更新须明确选择，禁止静默覆盖', async ({ page, context }) => {
  const second = await context.newPage(); await second.goto('/');
  await page.getByRole('button', { name: '文字输入', exact: true }).click(); await second.getByRole('button', { name: '文字输入', exact: true }).click();
  await page.getByLabel('输入食材与本餐信息', { exact: true }).fill('鸡蛋3个');
  await expect(second.getByRole('alert').filter({ hasText: '另一页面更新了这一餐' })).toBeVisible();
  await expect(second.getByRole('button', { name: '安排这一餐', exact: true })).toBeDisabled();
  await second.getByRole('button', { name: '载入另一页面版本', exact: true }).click();
  await expect(second.getByLabel('输入食材与本餐信息', { exact: true })).toHaveValue('鸡蛋3个'); await second.close();
});


test('收藏修复：详情按钮反馈、实心状态、卡片同步、快速取消与刷新持久化', async ({ page }, info) => {
  await parse(page, ingredients); await generate(page);
  const card = page.getByTestId('recipe-card').first(); const name = await card.locator('h4').innerText();
  await card.getByRole('button', { name: '看看做法', exact: false }).click();
  const dialog = page.getByRole('dialog', { name, exact: true });
  const add = dialog.getByRole('button', { name: new RegExp(`^收藏 ${name}`) });
  await add.click(); const remove = dialog.getByRole('button', { name: new RegExp(`^取消收藏 ${name}`) });
  await expect(remove).toHaveAttribute('aria-pressed', 'true'); await expect(remove).toHaveText('已收藏 · 点击取消');
  await expect(dialog.getByRole('status')).toContainText(`已收藏：${name}`);
  const feedbackBounds = await dialog.getByRole('status').boundingBox(), dialogBounds = await dialog.boundingBox();
  expect(feedbackBounds!.y + feedbackBounds!.height).toBeLessThanOrEqual(dialogBounds!.y + dialogBounds!.height - 4);
  await expect(remove.locator('svg')).toHaveAttribute('fill', 'currentColor');
  await dialog.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-favorite-detail.png` });
  await page.keyboard.press('Escape');
  const icon = card.getByRole('button', { name: `取消收藏 ${name}`, exact: true });
  await expect(icon).toHaveAttribute('aria-pressed', 'true');
  await expect(icon).toHaveCSS('color', 'rgb(185, 88, 62)');
  await expect(icon).toHaveCSS('border-radius', '50%');
  await card.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-favorite-card.png` });
  await card.getByRole('button', { name: '看看做法', exact: false }).click();
  await dialog.getByRole('button', { name: new RegExp(`^取消收藏 ${name}`) }).click();
  await expect(dialog.getByRole('status')).toContainText('已取消收藏');
  await dialog.getByRole('button', { name: new RegExp(`^收藏 ${name}`) }).click();
  await page.reload(); await page.getByRole('link', { name: '我的收藏', exact: false }).click();
  await expect(page.locator('.saved-recipes')).toContainText(name);
});

test('本机测试：登录和刷新保留食材收藏，退出不清除本餐且不会绕过AI账户门禁', async ({ page }, info) => {
  await parse(page, ingredients); await generate(page);
  const card = page.getByTestId('recipe-card').first(); const name = await card.locator('h4').innerText();
  await card.getByRole('button', { name: `收藏 ${name}`, exact: true }).click();
  await page.getByRole('button', { name: /健康模式/ }).click();
  await page.getByRole('button', { name: '登录测试账号', exact: true }).click();
  await expect(page.locator('.account-state')).toContainText('本机测试账号');await page.keyboard.press('Escape');
  await expect(page.locator('.health-entry .switch')).not.toHaveClass(/on/);
  await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'鸡蛋'})).toBeVisible(); await expect(page.getByLabel('鸡蛋用量',{exact:true})).toHaveCount(0);
  await generate(page); await expect(page.getByTestId('recipe-card')).toHaveCount(6);
  await page.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-health-test.png`, fullPage: true });
  await page.reload(); await expect(page.locator('.health-entry .switch')).not.toHaveClass(/on/);
  await page.getByRole('button', { name: '个人设置', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('已登录 · 本机测试账号');
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('已退出登录'); await page.keyboard.press('Escape');
  await expect(page.locator('.health-entry .switch')).not.toHaveClass(/on/);
  await expect(page.locator('.ingredients .ingredient-name').filter({hasText:'鸡蛋'})).toBeVisible(); await expect(page.getByLabel('鸡蛋用量',{exact:true})).toHaveCount(0);
  await page.getByRole('link', { name: '我的收藏', exact: false }).click(); await expect(page.locator('.saved-recipes')).toContainText(name);
});

test('D7-10: 菜数两态为不限数量与按荤素汤，选择持久化且互不污染', async ({ page }, info) => {
  await parse(page, ingredients);
  await expect(page.locator('.amount-hint')).toHaveCount(0);
  await expect(page.locator('.recommendation-mode strong')).toHaveText('不限数量');
  await generate(page); await expect(page.getByTestId('recipe-card')).toHaveCount(6);
  await expect(page.getByRole('button', { name: '不限数量', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '按荤素汤', exact: true }).click();
  await expect(page.getByLabel('荤菜道数', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('素菜道数', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('汤品道数', { exact: true })).toHaveValue('0');
  await page.getByLabel('素菜道数', { exact: true }).selectOption('2');
  await generate(page);
  await expect(page.locator('.recommendation-mode strong')).toHaveText('按需搭配');
  await expect(page.locator('.result-state')).toContainText('已按目标配齐');
  await expect(page.getByTestId('recipe-card')).toHaveCount(3);
  await page.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-counts.png` });
  await page.reload();
  await expect(page.getByRole('button', { name: '按荤素汤', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('素菜道数', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: '不限数量', exact: true }).click();
  await generate(page); await expect(page.getByTestId('recipe-card')).toHaveCount(6);
  await expect(page.locator('.notice')).toHaveCount(0);
});

test('D7-11: 只够几道时按类告知缺额，补买不凭空凑数，可切不限数量', async ({ page }, info) => {
  await parse(page, '土豆150g');
  await chooseCounts(page, 0, 0, 20);
  await generate(page);
  await expect(page.locator('.result-state')).toContainText('还缺：汤 20 道');
  await expect(page.getByRole('button', { name: '允许补买，按指定数量搭配', exact: true })).toBeVisible();
  const withoutBuy = await page.getByTestId('recipe-card').count();
  expect(withoutBuy).toBeLessThan(20);
  await page.getByRole('button', { name: '允许补买，按指定数量搭配', exact: true }).click();
  // 补买只补缺料，不改变“每道菜要复用现有主料”，土豆解锁的汤品仍有限。
  await expect(page.locator('.shortfall')).toBeVisible();
  expect(await page.getByTestId('recipe-card').count()).toBeLessThan(20);
  await page.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-shortfall.png`, fullPage: true });
  await page.getByRole('button', { name: '改成不限数量看看', exact: true }).click();
  await expect(page.locator('.recommendation-mode strong')).toHaveText('不限数量');
  await expect(page.getByTestId('recipe-card').first()).toBeVisible();
  const names = await page.getByTestId('recipe-card').locator('h4').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  const catalog = (await (await page.request.get('/api/v1/catalog/recipes')).json()).recipes;
  expect(names.every(name => catalog.some((recipe: { name: string }) => recipe.name === name))).toBe(true);
  await expect(page.locator('.notice')).toHaveCount(0);
});

test('D7-14: 做法和收藏不标人数，切换菜数不改变做法与用量', async ({ page }, info) => {
  await parse(page, ingredients); await page.getByRole('button', { name: '微辣', exact: true }).click(); await generate(page);
  const card = page.getByTestId('recipe-card').first(), name = await card.locator('h4').innerText();
  await card.getByRole('button', { name: '看看做法', exact: false }).click();
  const detail = page.getByRole('dialog', { name, exact: true });
  const reference = {
    meta: await detail.locator('.detail-meta').innerText(), amounts: await detail.locator('.detail-lines').innerText(),
    steps: await detail.locator('.steps').innerText(), nutrition: await detail.locator('.nutrition-box').allInnerTexts(),
  };
  await expect(detail).not.toContainText(/人份|人数|按当前.*人/);
  await detail.getByRole('button', { name: new RegExp(`^收藏 ${name}`) }).click(); await page.keyboard.press('Escape');
  await chooseCounts(page, 1, 2, 0);
  await page.getByRole('link', { name: '我的收藏', exact: false }).click();
  const favorites = page.locator('.saved-recipes');
  await expect(favorites).not.toContainText(/人份|人数/);
  await openSavedRecipe(page, name);
  await expect(detail).not.toContainText(/人份|人数|按当前.*人/);
  await expect(detail.locator('.detail-meta')).toHaveText(reference.meta, { useInnerText: true });
  await expect(detail.locator('.detail-lines')).toHaveText(reference.amounts, { useInnerText: true });
  await expect(detail.locator('.steps')).toHaveText(reference.steps, { useInnerText: true });
  await expect(detail.locator('.nutrition-box')).toHaveText(reference.nutrition, { useInnerText: true });
  await detail.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-fixed-favorite.png` });
});
