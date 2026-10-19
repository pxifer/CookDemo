import { test, expect, type Page } from '@playwright/test';

async function parse(page: Page, input: string) {
  await page.getByRole('button', { name: '文字输入', exact: true }).click();
  await page.getByLabel('输入食材与本餐信息', { exact: true }).fill(input);
  await page.getByRole('button', { name: '整理信息 ↗', exact: true }).click();
  await page.getByRole('button', { name: '追加到清单，逐项核对', exact: true }).click();
}
async function confirm(page: Page) { await page.getByRole('button', { name: '确认已知食材', exact: true }).click(); }
async function generate(page: Page) {
  await page.getByRole('button', { name: '安排这一餐', exact: false }).click();
  await expect(page.getByRole('button', { name: '安排这一餐', exact: false })).toBeEnabled();
}
async function openDetails(page: Page, text: string) {
  const summary = page.locator('summary').filter({ hasText: text });
  if (!(await summary.evaluate(e => (e.parentElement as HTMLDetailsElement).open))) await summary.click();
}
test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.getByRole('heading', { name: '看看有什么食材' })).toBeVisible(); });
test('AC-02/04/24: 连续文字、确认、数量冲突和刷新恢复', async ({ page }) => {
  await parse(page, '西红柿2个鸡蛋3个菠菜一把');
  await expect(page.getByLabel('鸡蛋用量', { exact: true })).toHaveValue('3个');
  await expect(page.getByLabel('菠菜用量', { exact: true })).toHaveValue('一把');
  await confirm(page); await parse(page, '鸡蛋5个');
  await expect(page.getByLabel('鸡蛋用量', { exact: true })).toHaveValue('3个');
  await expect(page.getByText(/追加值：5个/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '文字输入', exact: true }).click();
  await expect(page.getByLabel('鸡蛋用量', { exact: true })).toHaveValue('3个');
  await generate(page); await expect(page.getByText('同名食材数量或计量基准冲突，请逐项核对')).toBeVisible();
});
test('B01 / AC-06: 海产品先核对范围，未知限制阻断', async ({ page }) => {
  await parse(page, '鸡蛋3个西红柿500g虾300g海产品过敏'); await confirm(page);
  await generate(page); await expect(page.getByText('请核对限制：海产品')).toBeVisible();
  await openDetails(page, '过敏与明确忌口');
  await page.getByRole('button', { name: '确认此范围', exact: true }).click();
  await page.getByRole('button', { name: '多菜候选', exact: true }).click();
  await generate(page); const cards = page.getByTestId('recipe-card');
  await expect(cards.filter({ hasText: '虾仁滑蛋' })).toHaveCount(0);
  await page.getByLabel('添加限制名称', { exact: true }).fill('未识别过敏物');
  await page.locator('.restriction-add').getByRole('button', { name: '添加', exact: true }).click();
  await generate(page); await expect(page.getByText('请核对限制：未识别过敏物')).toBeVisible();
});
test('B02 / AC-23/25/26: 默认、本餐与演示隔离，退出及刷新恢复', async ({ page }) => {
  await parse(page, '鸡蛋2个，对虾过敏'); await confirm(page); await openDetails(page, '过敏与明确忌口');
  await page.getByRole('button', { name: '确认此范围', exact: true }).click();
  await page.getByRole('button', { name: '保存本餐设置为本机默认 ↗', exact: true }).click();
  await page.getByRole('button', { name: '用示例试试 ↗', exact: true }).click();
  await page.getByRole('button', { name: '微辣', exact: true }).click();
  await page.reload();
  await expect(page.getByText('正在体验独立演示')).toHaveCount(0);
  await expect(page.getByLabel('鸡蛋用量', { exact: true })).toHaveValue('2个');
  await openDetails(page, '过敏与明确忌口'); await expect(page.locator('.restrictions')).toContainText('对虾');
  await page.getByRole('button', { name: '用示例试试 ↗', exact: true }).click();
  await page.getByRole('button', { name: '退出并恢复本餐 ↗', exact: true }).click();
  await expect(page.getByLabel('鸡蛋用量', { exact: true })).toHaveValue('2个');
  await page.getByRole('button', { name: '开始新一餐 ↻', exact: true }).click();
  await expect(page.getByLabel('鸡蛋用量', { exact: true })).toHaveCount(0);
  await expect(page.locator('.restrictions')).toContainText('对虾');
});
test('B03/B04/B06: 不兼容数量提示、非法人数、精准补买差额', async ({ page }) => {
  await parse(page, '鸡蛋1g'); await confirm(page);
  await page.getByRole('spinbutton', { name: /几个人吃/ }).fill('12');
  await page.getByRole('button', { name: '多菜候选', exact: true }).click();
  await openDetails(page, '调味料与补买'); await page.getByLabel('我接受为本餐补买缺少的食材或数量').check();
  await generate(page); await expect(page.getByTestId('recipe-card').first()).toContainText('数量未核实');
  await page.getByRole('spinbutton', { name: /几个人吃/ }).fill('1.5'); await generate(page);
  await expect(page.getByRole('alert').filter({ hasText: '人数须为 1～12 的整数' })).toBeVisible();
  await page.getByRole('button', { name: '开始新一餐 ↻', exact: true }).click();
  await parse(page, '鸡肉1g香菇1g'); await confirm(page);
  await page.getByLabel('鸡肉计量基准', { exact: true }).selectOption('edible');
  await page.getByLabel('香菇计量基准', { exact: true }).selectOption('edible');
  await page.getByRole('spinbutton', { name: /几个人吃/ }).fill('12');
  await page.getByRole('button', { name: '多菜候选', exact: true }).click();
  await openDetails(page, '调味料与补买'); await page.getByLabel('我接受为本餐补买缺少的食材或数量').check();
  await generate(page); const dish = page.getByTestId('recipe-card').filter({ hasText: '香菇滑鸡' });
  await expect(dish).toContainText('还需 1439g'); await expect(dish).toContainText('还需 719g');
});
test('AC-18/19/20/21/32: 桌面手机主路径、单换、变体、详情和游客收藏', async ({ page }, info) => {
  await page.getByRole('button', { name: '用示例试试 ↗', exact: true }).click(); await generate(page);
  await expect(page.getByTestId('recipe-card')).toHaveCount(3);
  const before = await page.getByTestId('recipe-card').locator('h4').allTextContents();
  await page.getByRole('button', { name: `替换 ${before[1]}`, exact: true }).click();
  await expect(page.getByTestId('recipe-card').filter({ hasText: before[1] })).toHaveCount(0);
  const after = await page.getByTestId('recipe-card').locator('h4').allTextContents(); expect(after).toContain(before[0]); expect(after).toContain(before[2]);
  const first = page.getByTestId('recipe-card').first(); const name = await first.locator('h4').innerText();
  const flavorSelect = first.getByLabel(`${name}口味`); const values = await flavorSelect.locator('option').evaluateAll(es => es.map(e => (e as HTMLOptionElement).value));
  await flavorSelect.selectOption(values[1]); await expect(page.getByTestId('recipe-card')).toHaveCount(3);
  await page.getByTestId('recipe-card').filter({ hasText: name }).getByRole('button', { name: '看看做法', exact: false }).click();
  await expect(page.getByRole('dialog', { name })).toBeVisible(); await expect(page.getByRole('dialog')).toContainText('微辣');
  await expect(page.getByRole('dialog')).toContainText('干辣椒剪段'); await page.keyboard.press('Escape');
  await page.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-meal.png`, fullPage: true });
  await page.getByRole('button', { name: '退出并恢复本餐 ↗', exact: true }).click();
  await parse(page, '鸡肉300g香菇200g西红柿500g鸡蛋4个土豆500g菠菜300g西兰花300g黄瓜300g'); await confirm(page); await generate(page);
  const card = page.getByTestId('recipe-card').first(), favoriteName = await card.locator('h4').innerText();
  await card.getByRole('button', { name: `收藏 ${favoriteName}`, exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: '我的收藏', exact: false }).click();
  await expect(page.getByRole('dialog', { name: '我的本机收藏' })).toContainText(favoriteName);
});
test('B05 / AC-29: 疾病草稿、标签焦点、健康未开放出口', async ({ page }) => {
  await openDetails(page, '套餐组合与健康'); await page.getByRole('button', { name: '疾病名称与健康模式 →', exact: true }).click();
  const input = page.getByLabel('疾病名称草稿（未提交）', { exact: true }); await input.fill('偏头痛');
  await page.getByRole('button', { name: '糖尿病', exact: true }).click();
  await expect(input).toHaveValue('偏头痛'); await expect(page.getByRole('button', { name: '糖尿病', exact: true })).toBeFocused();
  await expect(page.getByRole('dialog')).toContainText('健康推荐保持关闭');
  await page.getByRole('button', { name: '主动使用普通模式，保留限制', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('V-07: 编辑未提交时晚到旧结果不覆盖；断流不能成功', async ({ page }) => {
  await parse(page, '鸡蛋4个西红柿500g土豆500g菠菜500g鸡肉500g香菇300g'); await confirm(page);
  let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/recommendations', async route => { const response = await route.fetch(); await wait; await route.fulfill({ response }); });
  await page.getByRole('button', { name: '安排这一餐', exact: false }).click();
  await page.getByRole('spinbutton', { name: /几个人吃/ }).fill('2'); release();
  await expect(page.getByTestId('recipe-card')).toHaveCount(0);
  await page.unroute('**/api/v1/recommendations');
  await page.route('**/api/v1/recommendations', route => route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'progress', stage: '输入已校验' }) + '\n' }));
  await generate(page); await expect(page.getByRole('status').filter({ hasText: '结果连接中断' })).toBeVisible();
  await expect(page.getByTestId('recipe-card')).toHaveCount(0);
});
test('D03/D04/D05: 输入切换键盘、弹层名称、布局与前端错误', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await expect(page.getByRole('button', { name: '拍照 / 上传', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: '今天，吃点什么？', exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: /有啥，做啥/ })).toBeVisible();
  await page.getByRole('button', { name: '拍照 / 上传', exact: true }).focus(); await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '文字输入', exact: true })).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('输入食材与本餐信息', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '拍照 / 上传', exact: true }).click();
  await expect(page.getByText('图片识别准备中 · 暂不上传图片', { exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  const baseline = await page.locator('.hero-banner').boundingBox();
  expect(baseline?.height).toBe(info.project.name === 'mobile' ? 175 : 210);
  if (info.project.name === 'desktop') expect((await page.locator('.input-column').boundingBox())?.width).toBe(345);
  await page.screenshot({ path: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/${info.project.name}-initial.png`, fullPage: true });
  expect(errors).toEqual([]);
});
test('AC-26: 取消与确认清空Demo均不删除真实草稿、默认或收藏', async ({ page }) => {
  await parse(page, '鸡蛋3个'); await confirm(page);
  await page.getByRole('button', { name: '保存本餐设置为本机默认 ↗', exact: true }).click();
  await page.getByRole('button', { name: '清空 Demo 数据', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByLabel('鸡蛋用量', { exact: true })).toHaveValue('3个');
  await page.getByRole('button', { name: '用示例试试 ↗', exact: true }).click();
  await page.getByRole('button', { name: '清空 Demo 数据', exact: true }).click();
  await page.getByRole('button', { name: '确认清空演示', exact: true }).click();
  await expect(page.getByLabel('鸡蛋用量', { exact: true })).toHaveValue('3个');
  await page.reload(); await expect(page.getByLabel('鸡蛋用量', { exact: true })).toHaveValue('3个');
});
test('AR-M03: 多标签页草稿更新须明确确认，禁止静默覆盖', async ({ page, context }) => {
  const second = await context.newPage(); await second.goto('/');
  await page.getByRole('button', { name: '文字输入', exact: true }).click();
  await second.getByRole('button', { name: '文字输入', exact: true }).click();
  await page.getByLabel('输入食材与本餐信息', { exact: true }).fill('鸡蛋3个');
  await expect(second.getByRole('alert').filter({ hasText: '另一页面更新了本机草稿' })).toBeVisible();
  await expect(second.getByRole('button', { name: '安排这一餐', exact: false })).toBeDisabled();
  await second.getByRole('button', { name: '载入另一页面版本', exact: true }).click();
  await expect(second.getByLabel('输入食材与本餐信息', { exact: true })).toHaveValue('鸡蛋3个');
  await second.close();
});

