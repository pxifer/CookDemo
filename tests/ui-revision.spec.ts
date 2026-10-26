import { test, expect } from '@playwright/test';

test.beforeEach(async ({page},info)=>{
  // The isolated gallery case must start without a workspace session request in flight.
  if(info.title.startsWith('图鉴不依赖'))return;
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
});
test('空食材补买默认推荐、动态口味与真实单菜变体',async({page})=>{
  const catalog=await (await page.request.get('/api/v1/catalog/recipes')).json();
  expect(catalog.contentVersion).toBe('local-business-ui-v2');
  await page.getByLabel('允许补买食材',{exact:false}).check();
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  await expect(page.getByTestId('recipe-card')).toHaveCount(6);
  await expect(page.getByText('请先添加一种食材；找不到时可以换个名称')).toHaveCount(0);
  const more=page.getByLabel('更多口味'); await more.selectOption('黑椒');
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  const card=page.getByTestId('recipe-card');await expect(card).toHaveCount(1);
  await expect(card.getByRole('heading')).toHaveText('胡萝卜炒牛肉');
  const recipe=catalog.recipes.find((r:any)=>r.name==='胡萝卜炒牛肉');
  expect(await card.getByRole('option').allTextContents()).toEqual(recipe.variants.map((v:any)=>v.flavor));
  await expect(card.locator('img[src="/assets/meat.png"],img[src="/assets/veg.png"],img[src="/assets/meal.png"]')).toHaveCount(0);
  await more.selectOption('酸甜');await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  await expect(card).toHaveCount(1);await expect(card.getByRole('heading')).toHaveText('番茄炒蛋');
  await expect(card.locator('img')).toHaveAttribute('src','/assets/recipes/tomato-scrambled-eggs-finedining-v1.png');
});
test('调料分组含真实目录内29种选项，单口味菜不伪造下拉',async({page})=>{
  await page.locator('.preference-shortcuts').getByRole('button',{name:/^调料/}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel('只使用家里现有的调料').check();
  await expect(dialog.locator('.pantry-groups input[type="checkbox"]')).toHaveCount(29);
  for(const name of ['蚝油','料酒','花椒','黑胡椒','淀粉','葱'])await expect(dialog.getByLabel(name,{exact:true})).toBeVisible();
  await dialog.getByLabel('只使用家里现有的调料').uncheck();await dialog.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByLabel('允许补买食材',{exact:false}).check();await page.getByLabel('更多口味').selectOption('清鲜');
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  const soup=page.getByTestId('recipe-card').filter({has:page.getByRole('heading',{name:'番茄蛋花汤',exact:true})});
  await expect(soup).toHaveCount(1);await expect(soup.getByRole('combobox')).toHaveCount(0);await expect(soup.locator('.flavor-label')).toContainText('清鲜');
});
test('图鉴独立页面、四栏筛选和详情、无来源链接且可刷新',async({page},info)=>{
  await page.getByRole('link',{name:'菜谱图鉴',exact:true}).click();await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.candidate-card')).toHaveCount(24);
  const db=await(await page.request.get('/api/v1/local/candidate-recipes')).json();
  expect(new Set(await page.getByLabel('按口味筛选').locator('option').allTextContents())).toEqual(new Set(['全部口味',...db.recipes.map((r:any)=>r.flavor)]));
  await expect(page.locator('.candidate-library a[href^="https:"]')).toHaveCount(0);
  for(const name of ['食材','做法','口味','菜品类型'])await expect(page.getByLabel(`按${name}筛选`)).toBeVisible();
  await page.getByLabel('搜索菜名',{exact:true}).fill('干锅花菜');await expect(page.locator('.candidate-card')).toHaveCount(1);
  await page.locator('.candidate-photo img').evaluate((img:HTMLImageElement)=>img.decode());
  await page.screenshot({path:info.outputPath('library-filter.png'),fullPage:true});
  await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();await expect(page).toHaveURL(/dish=/);
  await expect(page.getByRole('heading',{name:'干锅花菜',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();await expect(page.getByRole('heading',{name:'一步步做',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'← 返回菜谱图鉴',exact:true}).click();await expect(page.getByLabel('搜索菜名',{exact:true})).toHaveValue('干锅花菜');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/recipes?dish='+encodeURIComponent('鸡蛋羹'));
  await expect(page.getByRole('heading',{name:'鸡蛋羹',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);await expect(page.getByText('同口味做法参考（1）')).toBeVisible();
  await page.goto('/recipes?dish='+encodeURIComponent('清蒸鳜鱼'));
  await expect(page.getByLabel('清蒸鳜鱼口味')).toBeVisible();
  expect(new Set(await page.getByLabel('清蒸鳜鱼口味').locator('option').allTextContents())).toEqual(new Set(['清鲜','咸鲜带辣']));
});
test('图鉴筛选与第二页在刷新和浏览器返回后保留，翻页后回到结果区域',async({page})=>{
  await page.goto('/recipes?page=2');await expect(page.locator('.library-pagination')).toContainText('2 /');
  const first=await page.locator('.candidate-card h2').first().innerText();
  await page.locator('.candidate-card-actions button').first().click();await expect(page).toHaveURL(/dish=/);
  await expect(page.getByRole('heading',{name:first,exact:true})).toBeFocused();
  await page.goBack();await expect(page.locator('.library-pagination')).toContainText('2 /');await expect(page.locator('.candidate-card h2').first()).toHaveText(first);
  await expect(page.getByRole('button',{name:`查看${first}做法`,exact:true})).toBeFocused();
  await page.reload();await expect(page.locator('.library-pagination')).toContainText('2 /');
  await page.getByLabel('按食材筛选').selectOption('鸡肉');await page.reload();await expect(page.getByLabel('按食材筛选')).toHaveValue('鸡肉');
  await page.getByRole('button',{name:'清除筛选',exact:true}).click();await expect(page.locator('.candidate-card')).toHaveCount(24);
  await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.library-pagination')).toContainText('2 /');
  await expect(page.locator('.candidate-library-count')).toBeFocused();
});
test('图鉴坏链接、失效筛选和超大页码给出可恢复状态',async({page})=>{
  await page.goto('/recipes?dish='+encodeURIComponent('不存在的菜名'));
  await expect(page.getByRole('heading',{name:'没有找到这道菜谱',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'返回菜谱图鉴',exact:true}).click();await expect(page.locator('.candidate-card')).toHaveCount(24);
  await page.goto('/recipes?flavor=invalid&page=9999');await expect(page.getByLabel('按口味筛选')).toHaveValue('');
  await expect(page.getByText('部分筛选条件已失效，已清除；其他条件已保留。')).toBeVisible();await expect(page.locator('.candidate-card')).toHaveCount(24);
});

test('图鉴不依赖推荐目录或会话，读取失败重试仍保留搜索',async({page})=>{
  const unexpected:string[]=[];
  await page.route('**/api/v1/catalog/recipes',async route=>{unexpected.push('catalog');await route.fulfill({status:503,body:'{}'});});
  await page.route('**/api/v1/auth/session',async route=>{unexpected.push('session');await route.abort();});
  await page.route('**/api/v1/local/candidate-recipes',route=>route.fulfill({status:503,body:'{}'}));
  await page.goto('/recipes?q='+encodeURIComponent('干锅花菜'));
  await expect(page.getByRole('alert')).toContainText('图鉴暂时读取失败');
  await page.unroute('**/api/v1/local/candidate-recipes');
  await page.getByRole('button',{name:'重新读取',exact:true}).click();
  await expect(page.locator('.candidate-card')).toHaveCount(1);
  await expect(page.getByLabel('搜索菜名',{exact:true})).toHaveValue('干锅花菜');
  expect(unexpected).toEqual([]);
});

test('配图失效不显示破图或其他菜，图鉴步骤和推荐仍可使用',async({page})=>{
  await page.route('**/assets/recipes/*',route=>route.abort());
  await page.goto('/recipes?q='+encodeURIComponent('干锅花菜'));
  await expect(page.locator('.candidate-card img')).toHaveCount(0);
  await expect(page.locator('.candidate-card')).toContainText('配图暂不可用');
  await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
  await expect(page.getByText('这道菜的配图暂不可用，食材和步骤仍可查看。')).toBeVisible();
  await expect(page.getByRole('heading',{name:'一步步做',exact:true})).toBeVisible();
  await page.goto('/');await page.getByLabel('允许补买食材',{exact:false}).check();
  await page.getByLabel('更多口味').selectOption('酸甜');
  await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  const card=page.getByTestId('recipe-card');await expect(card).toHaveCount(1);
  await expect(card.locator('img')).toHaveCount(0);await expect(card).toContainText('配图暂不可用');
});

test('网页配图加载WebP，压缩文件失效时仍能回退同菜原图',async({page})=>{
  await page.goto('/recipes?q='+encodeURIComponent('干锅花菜'));
  const image=page.locator('.candidate-card img');
  await expect(image).toHaveCount(1);await image.evaluate((img:HTMLImageElement)=>img.decode());
  expect(await image.evaluate((img:HTMLImageElement)=>img.currentSrc)).toMatch(/\.webp$/);
  await page.route('**/assets/recipes/*.webp',route=>route.abort());
  await page.reload();await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.currentSrc)).toMatch(/\.png$/);
  await image.evaluate((img:HTMLImageElement)=>img.decode());
  await expect(image).toHaveAttribute('src','/assets/recipes/dry-pot-cauliflower-finedining-v1.png');
  expect(await image.evaluate((img:HTMLImageElement)=>img.currentSrc)).toMatch(/\.png$/);
  await expect(page.locator('.candidate-card')).not.toContainText('配图暂不可用');
});

test('候选原料纠错与数据库味型一致，仍明确待审核',async({page})=>{
  await page.goto('/recipes?dish='+encodeURIComponent('乾隆白菜'));
  await expect(page.locator('.library-flavor')).toHaveText('麻酱酸甜');
  await expect(page.getByText('已校正原料、口味或分类展示；仍为待审核候选。')).toBeVisible();
  await page.goto('/recipes?dish='+encodeURIComponent('黄焖鸡'));
  const ingredients=page.locator('.library-recipe-columns section').first();
  await expect(ingredients).toContainText('干辣椒 5～6 个');await expect(ingredients).not.toContainText('马蹄');
  await expect(page.locator('.steps')).toContainText('马蹄状');
  await page.goto('/recipes?dish='+encodeURIComponent('蒜蓉炒芹菜'));
  await expect(ingredients.getByText('蒜 4 瓣（切末）',{exact:true})).toBeVisible();
  await expect(ingredients.getByText('切末',{exact:true})).toHaveCount(0);
  await page.goto('/recipes?dish='+encodeURIComponent('排骨苦瓜汤'));
  const methods=page.getByRole('region',{name:'同口味做法参考'});
  await expect(methods).toContainText('二选一');await expect(methods.getByText(/120～240分钟/)).toBeVisible();
  await methods.getByText('电压力锅',{exact:true}).click();await expect(methods.getByText(/45分钟/)).toBeVisible();
  for(const dish of ['柱候牛腩','番茄炖牛腩','牛排','广式萝卜牛腩']){
    await page.goto('/recipes?q='+encodeURIComponent(dish)+'&category='+encodeURIComponent('荤菜'));
    await expect(page.locator('.candidate-card').filter({has:page.getByRole('heading',{name:dish,exact:true})})).toHaveCount(1);
    await page.getByLabel('按菜品类型筛选',{exact:true}).selectOption('素菜');
    await expect(page.locator('.candidate-card')).toHaveCount(0);
  }
});

test('新增社区原文只进候选图鉴，参考方法与待核事项可读',async({page})=>{
  const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  expect(catalog.contentVersion).toBe('local-business-ui-v2');expect(catalog.recipes).toHaveLength(18);
  expect(catalog.recipes.every((r:any)=>r.source.kind==='constructed')).toBe(true);
  await page.goto('/recipes?q='+encodeURIComponent('宫保鸡丁'));
  await expect(page.locator('.candidate-card')).toHaveCount(1);
  await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
  const notes=page.getByRole('complementary',{name:'配方待核事项'});await expect(notes).toContainText('待核');
  const methods=page.getByRole('region',{name:'同口味做法参考'});
  await expect(methods.getByText('简易版（原文名称）',{exact:true})).toBeVisible();
  await methods.getByText('进阶版（原文名称）',{exact:true}).click();await expect(methods).toContainText('莴笋');
  await expect(page.locator('.library-recipe-detail')).not.toContainText('预估卡路里');
  await page.goto('/recipes?dish='+encodeURIComponent('麻婆豆腐'));
  await expect(page.locator('.library-recipe-columns')).toContainText('咸鸭蛋1枚（原方只取蛋白）');
  await expect(page.getByRole('complementary',{name:'配方待核事项'})).toContainText('不等于传统');
});

test('图鉴打开筛选命中的实际口味，辅料也能用于食材分栏',async({page})=>{
  await page.goto('/recipes?q='+encodeURIComponent('清蒸鳜鱼')+'&flavor='+encodeURIComponent('清鲜'));
  await expect(page.locator('.candidate-card')).toHaveCount(1);
  await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
  const flavor=page.getByLabel('清蒸鳜鱼口味',{exact:true});
  await expect(flavor).toHaveValue('清鲜');
  expect((await flavor.getByRole('option').allTextContents()).sort()).toEqual(['咸鲜带辣','清鲜']);
  await flavor.selectOption('咸鲜带辣');await expect(flavor).toHaveValue('咸鲜带辣');
  await page.getByRole('button',{name:'← 返回菜谱图鉴',exact:true}).click();
  await expect(page.getByLabel('按口味筛选',{exact:true})).toHaveValue('清鲜');
  await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();await expect(flavor).toHaveValue('清鲜');
  await page.goto('/recipes?q='+encodeURIComponent('黄瓜炒肉')+'&ingredient='+encodeURIComponent('根茎瓜果'));
  await expect(page.locator('.candidate-card')).toHaveCount(1);
  await expect(page.locator('.candidate-card').getByRole('heading')).toHaveText('黄瓜炒肉');
});

