# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: resume.spec.ts >> 食材匹配：手动输入白菜猪肉粉条，未补买也能做对应菜且请求成功
- Location: tests\resume.spec.ts:4:1

# Error details

```
Error: expect(locator).not.toContainText(expected) failed

Locator: locator('.notice')
Expected substring: not "输入格式不合法"
Timeout: 7000ms
Error: element(s) not found

Call log:
  - Expect "not toContainText" locator('.notice') with timeout 7000ms
  - waiting for locator('.notice')

```

```yaml
- link "跳到本餐工作台":
  - /url: "#workspace"
- banner:
  - link "拾味首页":
    - /url: /
    - text: 拾 拾味 SHIWEI KITCHEN
  - navigation "主导航":
    - link "做饭工作台":
      - /url: /#workspace
    - link "菜谱图鉴":
      - /url: /recipes
    - link "我的收藏":
      - /url: /favorites
  - button "个人设置": 我
- main:
  - status: 图鉴菜谱已接入本机推荐；部分配方尚待逐项核对，请参照原方准备。营养缺项不作估算。
  - text: A LITTLE INSPIRATION, EVERY DAY
  - heading "今天，吃点什么？" [level=1]
  - paragraph: 打开冰箱，把手边的食材变成一顿好饭。
  - button "健康模式":
    - strong: 健康模式
  - text: 少一点纠结，多一点烟火气
  - heading "有啥，做啥。 好好吃一餐。" [level=2]
  - paragraph: 食材不浪费，搭配刚刚好。
  - img "番茄炒蛋、时蔬和汤的家常餐食示意": 家常滋味 · 图片为示意
  - heading "01 看看有什么食材" [level=2]
  - text: 3 种
  - group "输入方式":
    - button "拍照 / 上传" [pressed]
    - button "文字输入"
  - strong: 我的食材
  - text: 用量选填
  - paragraph: 填写用量，搭配菜数和补买建议会更精确。
  - list "我的食材":
    - listitem:
      - text: 白菜
      - textbox "白菜用量":
        - /placeholder: 选填
      - combobox "白菜单位":
        - option "g" [selected]
        - option "kg"
        - option "斤"
        - option "个"
        - option "ml"
        - option "l"
        - option "把"
        - option "根"
        - option "块"
      - button "删除食材 白菜": ×
    - listitem:
      - text: 猪肉
      - textbox "猪肉用量":
        - /placeholder: 选填
      - combobox "猪肉单位":
        - option "g" [selected]
        - option "kg"
        - option "斤"
        - option "个"
        - option "ml"
        - option "l"
        - option "把"
        - option "根"
        - option "块"
      - button "删除食材 猪肉": ×
    - listitem:
      - text: 粉条
      - textbox "粉条用量":
        - /placeholder: 选填
      - combobox "粉条单位":
        - option "g" [selected]
        - option "kg"
        - option "斤"
        - option "个"
        - option "ml"
        - option "l"
        - option "把"
        - option "根"
        - option "块"
      - button "删除食材 粉条": ×
  - combobox "手动添加食材"
  - button "＋ 添加" [disabled]
  - heading "02 这一餐的偏好" [level=2]
  - button "常用偏好 ↗"
  - text: 几个人吃
  - button "1 人配菜参考 · 查看人数表": 配菜参考 ↗
  - button "减少人数": −
  - spinbutton "几个人吃": "1"
  - button "增加人数": ＋
  - group "今天的口味":
    - text: 今天的口味
    - button "不限" [pressed]
    - combobox "更多口味":
      - option "更多" [selected]
      - option "葱香酱鲜"
      - option "葱香微辣"
      - option "葱香咸鲜"
      - option "醋香"
      - option "醋香咸鲜"
      - option "豆瓣咸鲜带辣"
      - option "豆瓣咸鲜微辣"
      - option "豆瓣鱼香"
      - option "豆豉咸鲜"
      - option "番茄糖醋"
      - option "糊辣酸甜"
      - option "酱甜"
      - option "酱香"
      - option "芥末"
      - option "酒香"
      - option "咖喱"
      - option "麻酱酸甜"
      - option "麻辣"
      - option "奶香"
      - option "奶香咸鲜"
      - option "清鲜"
      - option "酸辣"
      - option "蒜香"
      - option "糖醋"
      - option "甜口"
      - option "咸鲜"
      - option "咸鲜带辣"
      - option "咸鲜微辣"
      - option "香辣"
  - button "过敏 未设置"
  - button "忌口 未设置"
  - button "调料 不限库存"
  - checkbox "允许补买食材 只用现有食材，直接搭配一餐"
  - text: 允许补买食材 只用现有食材，直接搭配一餐
  - button "安排这一餐": 搭配这一餐 ✧
  - region "本餐推荐":
    - text: MADE FOR YOUR TABLE
    - heading "这一餐，安排好了" [level=2]
    - strong: 一键搭配
    - text: 按人数、食材种类和用量灵活搭配
    - button "开始新一餐 ↻"
    - button "荤素汤搭配 ⌄"
    - paragraph: 1 人用餐 · 按我的饮食要求 · 不额外补买
    - status:
      - strong: 为你找到 3 道
      - paragraph: 1 人参考 1 荤 2 素，本次按食材种类与用量搭配 3 道；参考数量不强制凑齐
      - paragraph: 填写用量能让菜数与补买建议更精确；重量、单位或处理方式尚未核实的食材，请按菜谱用量准备
    - article:
      - img "乾隆白菜成品示意"
      - text: "01"
      - button "收藏 乾隆白菜"
      - text: 成品示意 素菜 家常菜 10 分钟
      - heading "乾隆白菜" [level=4]
      - paragraph: 白菜
      - paragraph: 用量请参考菜谱
      - list
      - text: 单菜口味
      - strong: 麻酱酸甜
      - paragraph: 热量 暂无法计算
      - button "看看做法 ↗"
      - button "替换 乾隆白菜": 换一道 ↻
    - article:
      - img "白菜猪肉炖粉条成品示意"
      - text: "02"
      - button "收藏 白菜猪肉炖粉条"
      - text: 成品示意 荤菜 家常菜 时间见做法
      - heading "白菜猪肉炖粉条" [level=4]
      - paragraph: 五花肉 · 白菜 · 土豆干粉条
      - paragraph: 食材大类已匹配，具体部位/用量待核对
      - list
      - text: 单菜口味
      - strong: 咸鲜
      - paragraph: 热量 暂无法计算
      - button "看看做法 ↗"
      - button "替换 白菜猪肉炖粉条": 换一道 ↻
    - article:
      - img "蚂蚁上树，配图暂不可用":
        - text: SHIWEI KITCHEN
        - strong: 蚂蚁上树
        - text: 配图暂不可用
      - text: "03"
      - button "收藏 蚂蚁上树"
      - text: 荤菜 家常菜 时间见做法
      - heading "蚂蚁上树" [level=4]
      - paragraph: 红薯粉丝 · 猪肉末
      - paragraph: 食材大类已匹配，具体部位/用量待核对
      - list
      - text: 单菜口味
      - strong: 豆瓣咸鲜带辣
      - paragraph: 热量 暂无法计算
      - button "看看做法 ↗"
      - button "替换 蚂蚁上树": 换一道 ↻
    - group: 本餐用量与补买清单
    - button "整套重推 ↻"
    - paragraph: 菜谱用量供参考，请根据实际食材和人数调整。
- contentinfo: 拾味 把日子，过得有滋有味。 好好吃饭，好好生活。
- button "搭配这一餐 3 种食材 · 1 人用餐"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { defaultMeal } from '../shared/types';
  3   | 
  4   | test('食材匹配：手动输入白菜猪肉粉条，未补买也能做对应菜且请求成功',async({page},info)=>{
  5   |   await page.goto('/');
  6   |   for(const name of ['白菜','猪肉','粉条']){
  7   |     await page.getByLabel('手动添加食材',{exact:true}).fill(name);
  8   |     await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  9   |   }
  10  |   const pending=page.waitForResponse(response=>response.url().endsWith('/api/v1/recommendations'));
  11  |   await page.locator('.generate-button').click();
  12  |   expect((await pending).status()).toBe(200);
  13  |   await expect(page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'})).toBeVisible();
  14  |   await expect(page.getByTestId('recipe-card').filter({hasText:'包菜炒鸡蛋粉丝'})).toHaveCount(0);
> 15  |   await expect(page.locator('.notice')).not.toContainText('输入格式不合法');
      |                                             ^ Error: expect(locator).not.toContainText(expected) failed
  16  |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  17  |   await page.screenshot({path:info.outputPath('simple-ingredient-match.png'),fullPage:true});
  18  | });
  19  | 
  20  | test('食材匹配：文字只写粉条即可查相关菜谱，不必输入土豆干粉条',async({page})=>{
  21  |   await page.goto('/');
  22  |   await page.getByRole('button',{name:'文字输入',exact:true}).click();
  23  |   await page.getByLabel('输入食材与本餐信息',{exact:true}).fill('粉条');
  24  |   await page.getByRole('button',{name:'整理信息 ↗',exact:true}).click();
  25  |   await expect(page.getByLabel('粉条用量',{exact:true})).toBeVisible();
  26  |   await page.getByLabel('允许补买食材',{exact:false}).check();
  27  |   await page.locator('.generate-button').click();
  28  |   await expect(page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'})).toBeVisible();
  29  |   for(const text of await page.locator('.recipe-card .card-ingredients').allTextContents())expect(text).toMatch(/粉条|粉丝|宽粉/);
  30  | });
  31  | 
  32  | test('食材匹配：恢复旧草稿时修复误生成的未分类粉条，保留输入后能推荐',async({page})=>{
  33  |   const meal={...defaultMeal(),ingredients:['白菜','猪肉','粉条'].map((name,index)=>({id:`old-input-${index}`,foodId:['cabbage','pork',null][index],name,amount:'',basis:'unknown',form:'raw',status:index===2?'pending':'confirmed',original:name})),
  34  |     restrictions:[{id:'legacy-unresolved',kind:'unclassified',name:'未分类：粉条',original:'未分类：粉条',targets:[],status:'unknown',scope:'self'}]};
  35  |   await page.addInitScript(value=>localStorage.setItem('shiwei:guest:meal:v1',JSON.stringify(value)),meal);
  36  |   await page.goto('/');
  37  |   await expect(page.locator('.preference-shortcuts button').filter({hasText:'忌口'})).toContainText('未设置');
  38  |   await expect(page.getByLabel('粉条用量',{exact:true})).toBeVisible();
  39  |   await page.locator('.generate-button').click();
  40  |   await expect(page.getByTestId('recipe-card').filter({hasText:'白菜猪肉炖粉条'})).toBeVisible();
  41  | });
  42  | 
  43  | test('三个页面导航位置一致且手机无横向溢出，收藏可直接刷新',async({page},info)=>{
  44  |   const boxes:unknown[]=[];
  45  |   for(const path of ['/#workspace','/recipes','/favorites']){
  46  |     await page.goto(path);await expect(page.locator('.site-header')).toBeVisible();
  47  |     await expect(page.getByRole('navigation',{name:'主导航'}).getByRole('link')).toHaveCount(3);
  48  |     boxes.push(await page.locator('.site-header nav').boundingBox());
  49  |     expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  50  |     await page.screenshot({path:info.outputPath(`${path.startsWith('/recipes')?'gallery':path.startsWith('/favorites')?'favorites':'workspace'}.png`),fullPage:true});
  51  |   }
  52  |   expect(boxes[1]).toEqual(boxes[0]);expect(boxes[2]).toEqual(boxes[0]);
  53  |   await page.reload();await expect(page.getByRole('heading',{name:'我的收藏',exact:true})).toBeVisible();
  54  |   await expect(page.getByRole('dialog')).toHaveCount(0);
  55  | });
  56  | 
  57  | test('可省胡萝卜不将松仁玉米归入根茎瓜果，原方仍显示可省说明',async({page})=>{
  58  |   await page.goto('/recipes?q='+encodeURIComponent('松仁玉米'));
  59  |   await expect(page.locator('.candidate-card')).toHaveCount(1);
  60  |   await page.getByLabel('按食材筛选').selectOption('根茎瓜果');
  61  |   await expect(page.locator('.candidate-card')).toHaveCount(0);
  62  |   await page.getByLabel('按食材筛选').selectOption('');
  63  |   await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
  64  |   await expect(page.getByText('胡萝卜 50 g（切小丁，可省略）',{exact:true})).toBeVisible();
  65  | });
  66  | 
  67  | test('多口味卡片只列真实口味，选择后详情同步切换',async({page})=>{
  68  |   await page.goto('/recipes?q='+encodeURIComponent('清蒸鳜鱼'));
  69  |   await expect(page.locator('.candidate-library-count')).toContainText('2 种不同口味做法');
  70  |   const select=page.getByLabel('清蒸鳜鱼口味');await expect(select.locator('option')).toHaveCount(2);
  71  |   await select.selectOption('咸鲜带辣');
  72  |   await expect(page.getByRole('heading',{name:'清蒸鳜鱼',exact:true})).toBeVisible();
  73  |   await expect(page.getByLabel('清蒸鳜鱼口味')).toHaveValue('咸鲜带辣');
  74  |   await page.getByRole('button',{name:'返回菜谱图鉴'}).click();
  75  |   await expect(page.locator('.candidate-card')).toHaveCount(1);
  76  |   await expect(page.getByLabel('清蒸鳜鱼口味')).toHaveValue('清鲜');
  77  | });
  78  | 
  79  | test('真实数据库图鉴145道均可在工作台候选分页推荐，数量不伪造',async({page})=>{
  80  |   const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json();
  81  |   const gallery=await(await page.request.get('/api/v1/local/candidate-recipes')).json();
  82  |   const expected=new Set(gallery.recipes.map((r:any)=>r.dish_key));
  83  |   expect(expected.size).toBe(145);expect(new Set(catalog.recipes.map((r:any)=>r.name))).toEqual(expected);
  84  |   expect(catalog.contentState).toBe('database-candidate');
  85  |   const session=await(await page.request.get('/api/v1/auth/session')).json();
  86  |   const names=new Set<string>();
  87  |   for(let index=0;index<25;index++){
  88  |     const response=await page.request.post('/api/v1/recommendations',{headers:{Origin:'http://127.0.0.1:4176','x-csrf-token':session.csrfToken},data:{contentVersion:catalog.contentVersion,operationId:crypto.randomUUID(),meal:{...defaultMeal(),mode:'candidates',allowBuy:true},action:'page',page:index,selected:[],previous:[]}});
  89  |     expect(response.status()).toBe(200);const result=await response.json();expect(result.total).toBe(145);
  90  |     for(const d of result.dishes)names.add(d.recipe.name);
  91  |   }
  92  |   expect(names).toEqual(expected);
  93  |   await page.goto('/');await page.getByLabel('允许补买食材',{exact:false}).check();await page.getByRole('button',{name:'安排这一餐',exact:true}).click();
  94  |   await expect(page.getByTestId('recipe-card')).toHaveCount(6);
  95  |   await expect(page.locator('.result-actions')).toContainText('25');
  96  | });
  97  | 
  98  | test('图鉴收藏进入独立页面，刷新复查且移除后持久保留其他收藏',async({page})=>{
  99  |   await page.goto('/recipes?q='+encodeURIComponent('凉拌黄瓜'));
  100 |   const favorite=page.getByRole('button',{name:'收藏 凉拌黄瓜',exact:true});await favorite.click();
  101 |   await expect(page.getByRole('button',{name:'取消收藏 凉拌黄瓜',exact:true})).toHaveAttribute('aria-pressed','true');
  102 |   await page.getByRole('button',{name:'取消收藏 凉拌黄瓜',exact:true}).click();
  103 |   await expect(page.getByRole('button',{name:'收藏 凉拌黄瓜',exact:true})).toHaveAttribute('aria-pressed','false');
  104 |   await page.getByRole('button',{name:'收藏 凉拌黄瓜',exact:true}).click();
  105 |   await expect(page.locator('.library-review-note[role="status"]')).toContainText('已收藏：凉拌黄瓜');
  106 |   await page.getByRole('link',{name:'我的收藏',exact:false}).click();
  107 |   await expect(page).toHaveURL(/\/favorites$/);await page.reload();
  108 |   await expect(page.locator('.favorite-row')).toContainText('凉拌黄瓜');
  109 |   await expect(page.locator('.favorite-row img.favorite-thumb')).toHaveCount(1);
  110 |   await page.locator('.favorite-row button').first().click();
  111 |   await expect(page.getByRole('dialog',{name:'凉拌黄瓜',exact:true})).toBeVisible();
  112 |   await expect(page.getByRole('dialog')).toContainText('尚未逐项完成');
  113 |   await page.keyboard.press('Escape');
  114 |   await page.getByRole('button',{name:'移除收藏 凉拌黄瓜',exact:true}).click();await page.reload();
  115 |   await expect(page.locator('.favorite-row')).toHaveCount(0);
```