import { test, expect } from './local-browser';
import { defaultMeal } from '../shared/types';

test('推荐展示：补买只列原方食材与用量，不限调料不标葱姜，无开发提示',async({page},info)=>{
  await page.goto('/');
  await page.getByLabel('手动添加食材',{exact:true}).fill('粉条');
  await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  await page.getByLabel('允许补买食材',{exact:false}).check();
  await page.locator('.generate-button').click();
  const card=page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'});
  await expect(card).toBeVisible();
  await expect(card.locator('.shopping-list')).toContainText('需要补买');
  await expect(card.locator('.checks')).toContainText(/五花肉.*300/);
  await expect(card.locator('.checks')).not.toContainText(/粉条|葱|姜|蒜|核对|未注明|无法估算|缺量/);
  await expect(page.locator('main')).not.toContainText(/图鉴菜谱已接入|配方尚待逐项|本次按食材种类|填写用量能让|参考数量不强制/);
  await expect(card).not.toContainText(/暂无法计算|时间见做法/);
  await card.getByRole('button',{name:'看看做法',exact:false}).click();
  await expect(page.getByRole('dialog')).toContainText('食材与用量');
  await expect(page.getByRole('dialog')).not.toContainText(/本机试用|计量基准待核实|暂无法计算/);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('shopping-simple.png'),fullPage:true});
});

test('推荐展示：调料选项没有水、鱼、奶或面粉，葱姜蒜切法共用一项',async({page},info)=>{
  await page.goto('/');
  await page.locator('.preference-shortcuts button').filter({hasText:'调料'}).click();
  const modal=page.getByRole('dialog',{name:'调料设置'});
  await modal.getByLabel('只使用家里现有的调料',{exact:true}).check();
  for(const name of ['清水','热水','开水','冰水','饮用水','凉白开水','水','鱼','豆腐','牛奶','纯牛奶','酸奶','淡奶油','鹰嘴豆粉','糯米粉','粘米粉','可乐','葱段','姜片','蒜末'])await expect(modal.getByRole('checkbox',{name,exact:true})).toHaveCount(0);
  await expect(modal.getByRole('checkbox',{name:'生姜',exact:true})).toHaveCount(1);
  await expect(modal.getByRole('checkbox',{name:'鱼露',exact:true})).toHaveCount(1);
  await page.screenshot({path:info.outputPath('seasoning-options.png'),fullPage:true});
});

test('推荐变化：大量现有食材重复搭配会变化，补买候选重新生成也有不同顺序',async({page},info)=>{
  await page.goto('/');
  for(const name of ['鸡蛋','土豆','西红柿','猪肉','牛肉','白菜','粉条','黄瓜','豆腐','鸡肉','香菇','西兰花','青椒','胡萝卜']){
    await page.getByLabel('手动添加食材',{exact:true}).fill(name);
    await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  }
  const noBuy:string[][]=[],withBuy:string[][]=[];
  for(const allowBuy of [false,true]){
    await page.getByLabel('允许补买食材',{exact:false}).setChecked(allowBuy);
    for(let n=0;n<4;n++){
      const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations'));
      await page.locator('.generate-button').click();
      const r=await response;expect(r.status()).toBe(200);
      await expect(page.locator('.generate-button')).toBeEnabled();
      const names=await page.locator('.recipe-card h4').allTextContents();
      expect(names.length).toBeGreaterThan(0);
      (allowBuy?withBuy:noBuy).push(names);
      await expect(page.locator('.recipe-grid')).not.toContainText(/未注明用量|无法估算|请核对库存|计量基准/);
    }
  }
  expect(new Set(noBuy.map(names=>[...names].sort().join(','))).size).toBeGreaterThan(1);
  expect(new Set(withBuy.map(names=>names.join(','))).size).toBeGreaterThan(1);
  await info.attach('actual-variations',{body:JSON.stringify({noBuy,withBuy},null,2),contentType:'application/json'});
});

test('食材匹配：手动输入白菜猪肉粉条，未补买也能做对应菜且请求成功',async({page},info)=>{
  await page.goto('/');
  for(const name of ['白菜','猪肉','粉条']){
    await page.getByLabel('手动添加食材',{exact:true}).fill(name);
    await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  }
  const pending=page.waitForResponse(response=>response.url().endsWith('/api/v1/recommendations'));
  await page.locator('.generate-button').click();
  expect((await pending).status()).toBe(200);
  await expect(page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'})).toBeVisible();
  await expect(page.getByTestId('recipe-card').filter({hasText:'包菜炒鸡蛋粉丝'})).toHaveCount(0);
  await expect(page.locator('.notice').filter({hasText:'输入格式不合法'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('simple-ingredient-match.png'),fullPage:true});
});

test('食材匹配：文字只写粉条即可查相关菜谱，不必输入土豆干粉条',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'文字输入',exact:true}).click();
  await page.getByLabel('输入食材与本餐信息',{exact:true}).fill('粉条');
  await page.getByRole('button',{name:'整理信息 ↗',exact:true}).click();
  await expect(page.getByLabel('粉条用量',{exact:true})).toBeVisible();
  await page.getByLabel('允许补买食材',{exact:false}).check();
  await page.locator('.generate-button').click();
  await expect(page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'})).toBeVisible();
  for(const text of await page.locator('.recipe-card .card-ingredients').allTextContents())expect(text).toMatch(/粉条|粉丝|宽粉/);
});

test('食材匹配：恢复旧草稿时修复误生成的未分类粉条，保留输入后能推荐',async({page})=>{
  const meal={...defaultMeal(),ingredients:['白菜','猪肉','粉条'].map((name,index)=>({id:`old-input-${index}`,foodId:['cabbage','pork',null][index],name,amount:'',basis:'unknown',form:'raw',status:index===2?'pending':'confirmed',original:name})),
    restrictions:[{id:'legacy-unresolved',kind:'unclassified',name:'未分类：粉条',original:'未分类：粉条',targets:[],status:'unknown',scope:'self'}]};
  await page.addInitScript(value=>localStorage.setItem('shiwei:guest:meal:v1',JSON.stringify(value)),meal);
  await page.goto('/');
  await expect(page.locator('.preference-shortcuts button').filter({hasText:'忌口'})).toContainText('未设置');
  await expect(page.getByLabel('粉条用量',{exact:true})).toBeVisible();
  await page.locator('.generate-button').click();
  await expect(page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'})).toBeVisible();
});

test('三个页面导航位置一致且手机无横向溢出，收藏可直接刷新',async({page},info)=>{
  const boxes:unknown[]=[];
  for(const path of ['/#workspace','/recipes','/favorites']){
    await page.goto(path);await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.getByRole('navigation',{name:'主导航'}).getByRole('link')).toHaveCount(3);
    boxes.push(await page.locator('.site-header nav').boundingBox());
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`${path.startsWith('/recipes')?'gallery':path.startsWith('/favorites')?'favorites':'workspace'}.png`),fullPage:true});
  }
  expect(boxes[1]).toEqual(boxes[0]);expect(boxes[2]).toEqual(boxes[0]);
  await page.reload();await expect(page.getByRole('heading',{name:'我的收藏',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('可省胡萝卜不将松仁玉米归入根茎瓜果，原方仍显示可省说明',async({page})=>{
  await page.goto('/recipes?q='+encodeURIComponent('松仁玉米'));
  await expect(page.locator('.candidate-card')).toHaveCount(1);
  await page.getByLabel('按食材筛选').selectOption('根茎瓜果');
  await expect(page.locator('.candidate-card')).toHaveCount(0);
  await page.getByLabel('按食材筛选').selectOption('');
  await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
  await expect(page.getByText('胡萝卜 50 g（切小丁，可省略）',{exact:true})).toBeVisible();
});

test('多口味卡片只列真实口味，选择后详情同步切换',async({page})=>{
  await page.goto('/recipes?q='+encodeURIComponent('清蒸鳜鱼'));
  await expect(page.locator('.candidate-library-count')).toContainText('2 种不同口味做法');
  const select=page.getByLabel('清蒸鳜鱼口味');await expect(select.locator('option')).toHaveCount(2);
  await select.selectOption('咸鲜带辣');
  await expect(page.getByRole('heading',{name:'清蒸鳜鱼',exact:true})).toBeVisible();
  await expect(page.getByLabel('清蒸鳜鱼口味')).toHaveValue('咸鲜带辣');
  await page.getByRole('button',{name:'返回菜谱图鉴'}).click();
  await expect(page.locator('.candidate-card')).toHaveCount(1);
  await expect(page.getByLabel('清蒸鳜鱼口味')).toHaveValue('清鲜');
});

test('真实数据库图鉴145道均可在工作台候选分页推荐，数量不伪造',async({page})=>{
  const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  const gallery=await(await page.request.get('/api/v1/local/candidate-recipes')).json();
  const expected=new Set(gallery.recipes.map((r:any)=>r.dish_key));
  expect(expected.size).toBe(145);expect(new Set(catalog.recipes.map((r:any)=>r.name))).toEqual(expected);
  expect(catalog.contentState).toBe('database-candidate');
  const session=await(await page.request.get('/api/v1/auth/session')).json();
  const names=new Set<string>();
  let cursor:string|undefined;
  for(let index=0;index<25;index++){
    const response=await page.request.post('/api/v1/recommendations',{headers:{Origin:'http://127.0.0.1:4176','x-csrf-token':session.csrfToken},data:{contentVersion:catalog.contentVersion,operationId:crypto.randomUUID(),meal:{...defaultMeal(),mode:'candidates',allowBuy:true},action:'page',page:index,...(cursor?{cursor}:{}),selected:[],previous:[]}});
    expect(response.status()).toBe(200);const result=await response.json();cursor=result.cursor;expect(result.total).toBe(145);
    for(const d of result.dishes)names.add(d.recipe.name);
  }
  expect(names).toEqual(expected);
  await page.goto('/');await page.getByLabel('允许补买食材',{exact:false}).check();await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  await expect(page.getByTestId('recipe-card')).toHaveCount(6);
  await expect(page.locator('.result-actions')).toContainText('25');
});

test('图鉴收藏进入独立页面，刷新复查且移除后持久保留其他收藏',async({page})=>{
  await page.goto('/recipes?q='+encodeURIComponent('凉拌黄瓜'));
  const favorite=page.getByRole('button',{name:'收藏 凉拌黄瓜',exact:true});await favorite.click();
  await expect(page.getByRole('button',{name:'取消收藏 凉拌黄瓜',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'取消收藏 凉拌黄瓜',exact:true}).click();
  await expect(page.getByRole('button',{name:'收藏 凉拌黄瓜',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'收藏 凉拌黄瓜',exact:true}).click();
  await expect(page.locator('.library-review-note[role="status"]')).toContainText('已收藏：凉拌黄瓜');
  await page.getByRole('link',{name:'我的收藏',exact:false}).click();
  await expect(page).toHaveURL(/\/favorites$/);await page.reload();
  await expect(page.locator('.favorite-row')).toContainText('凉拌黄瓜');
  await expect(page.locator('.favorite-row img.favorite-thumb')).toHaveCount(1);
  await page.locator('.favorite-row button').first().click();
  await expect(page.getByRole('dialog',{name:'凉拌黄瓜',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('食材与用量');
  await expect(page.getByRole('dialog')).not.toContainText('尚未逐项完成');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'移除收藏 凉拌黄瓜',exact:true}).click();await page.reload();
  await expect(page.locator('.favorite-row')).toHaveCount(0);
});

test('图鉴收藏立即反馈且只锁定当前卡片',async({page})=>{
  await page.route('**/api/v1/catalog/recipes',async route=>{await new Promise(resolve=>setTimeout(resolve,500));await route.continue();});
  await page.goto('/recipes');
  const buttons=page.locator('.candidate-card-actions button[aria-pressed]');
  await expect(buttons).toHaveCount(24);
  await buttons.nth(0).click();
  await expect(buttons.nth(0)).toBeDisabled();
  await expect(buttons.nth(0)).toHaveAttribute('aria-pressed','true');
  await expect(buttons.nth(1)).not.toBeDisabled();
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed','false');
});

test('图片选择和拍照入口可用，预览不上传，错误保留原图且刷新不保留照片',async({page})=>{
  const uploads:string[]=[];page.on('request',request=>{if(request.url().includes('/recognitions/image'))uploads.push(request.url());});
  await page.goto('/');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=','base64');
  const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'选择图片',exact:true}).click();
  const chooser=await chooserPromise;await chooser.setFiles({name:'食材.png',mimeType:'image/png',buffer:bytes});
  await expect(page.getByAltText('本次食材图片预览')).toBeVisible();
  await expect(page.getByLabel('拍摄食材图片')).toHaveAttribute('capture','environment');
  const cameraPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'手机拍照',exact:true}).click();
  await(await cameraPromise).setFiles({name:'拍照.png',mimeType:'image/png',buffer:bytes});
  await expect(page.locator('.photo-preview')).toContainText('拍照.png');
  await page.getByLabel('选择食材图片').setInputFiles({name:'过大.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)});
  await expect(page.getByRole('alert')).toContainText('5 MiB');await expect(page.locator('.photo-preview')).toContainText('拍照.png');
  await page.getByRole('button',{name:'移除图片',exact:true}).click();await expect(page.locator('.photo-preview')).toHaveCount(0);
  await page.getByLabel('选择食材图片').setInputFiles({name:'食材.png',mimeType:'image/png',buffer:bytes});
  await page.reload();await expect(page.locator('.photo-preview')).toHaveCount(0);expect(uploads).toEqual([]);
});
