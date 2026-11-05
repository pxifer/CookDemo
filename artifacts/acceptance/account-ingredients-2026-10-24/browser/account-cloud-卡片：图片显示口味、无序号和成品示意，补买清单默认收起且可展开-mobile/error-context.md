# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: account-cloud.spec.ts >> 卡片：图片显示口味、无序号和成品示意，补买清单默认收起且可展开
- Location: tests\account-cloud.spec.ts:20:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('recipe-card')
Expected: 6
Received: 4
Timeout:  20000ms

Call log:
  - Expect "toHaveCount" getByTestId('recipe-card') with timeout 20000ms
  - waiting for getByTestId('recipe-card')
    9 × locator resolved to 0 elements
      - unexpected value "0"
    34 × locator resolved to 4 elements
       - unexpected value "4"

```

# Page snapshot

```yaml
- generic [ref=f1e2]:
  - link "跳到本餐工作台" [ref=f1e3] [cursor=pointer]:
    - /url: "#workspace"
  - banner [ref=f1e4]:
    - link "拾味首页" [ref=f1e5] [cursor=pointer]:
      - /url: /
      - generic [ref=f1e6]: 拾
      - generic [ref=f1e7]:
        - text: 拾味
        - generic [ref=f1e8]: SHIWEI KITCHEN
    - navigation "主导航" [ref=f1e9]:
      - link "做饭工作台" [ref=f1e10] [cursor=pointer]:
        - /url: /#workspace
      - link "菜谱图鉴" [ref=f1e11] [cursor=pointer]:
        - /url: /recipes
      - link "我的收藏" [ref=f1e12] [cursor=pointer]:
        - /url: /favorites
    - button "个人设置" [ref=f1e14] [cursor=pointer]: 我
  - main [ref=f1e15]:
    - generic [ref=f1e16]:
      - generic [ref=f1e17]:
        - generic [ref=f1e18]: A LITTLE INSPIRATION, EVERY DAY
        - heading "今天，吃点什么？" [level=1] [ref=f1e19]:
          - text: 今天，吃点什么？
          - generic [aria-hidden] [ref=f1e20]: ✳
        - paragraph [ref=f1e21]: 打开冰箱，把手边的食材变成一顿好饭。
      - button [ref=f1e22] [cursor=pointer]:
        - generic [aria-hidden] [ref=f1e23]: ♡
        - strong [ref=f1e25]: 健康模式
    - generic [ref=f1e27]:
      - generic [ref=f1e28]:
        - generic [ref=f1e29]: 少一点纠结，多一点烟火气
        - heading "有啥，做啥。 好好吃一餐。" [level=2] [ref=f1e31]: 有啥，做啥。好好吃一餐。
        - paragraph [ref=f1e32]: 食材不浪费，搭配刚刚好。
      - img "番茄炒蛋、时蔬和汤的家常餐食示意" [ref=f1e33]:
        - generic [ref=f1e34]: 家常滋味 · 图片为示意
      - generic [aria-hidden] [ref=f1e35]: ✳
    - generic [ref=f1e36]:
      - generic [ref=f1e37]:
        - generic [ref=f1e38]:
          - generic [ref=f1e39]:
            - heading "01 看看有什么食材" [level=2] [ref=f1e40]:
              - generic [ref=f1e41]: "01"
              - text: 看看有什么食材
            - generic [ref=f1e42]: 1 种
          - group "输入方式" [ref=f1e43]:
            - button "拍照 / 上传" [pressed] [ref=f1e44] [cursor=pointer]
            - button "文字输入" [ref=f1e45] [cursor=pointer]
          - generic [ref=f1e46]:
            - strong [ref=f1e47]: 我的食材
            - generic [ref=f1e48]: 用量选填
          - paragraph [ref=f1e49]: 填写用量，搭配菜数和补买建议会更精确。
          - list "我的食材" [ref=f1e50]:
            - listitem [ref=f1e51]:
              - generic [ref=f1e52]:
                - generic "白菜" [ref=f1e53]
                - textbox "白菜用量" [ref=f1e54]:
                  - /placeholder: 选填
                - combobox "白菜单位" [ref=f1e55]:
                  - option "g" [selected]
                  - option "kg"
                  - option "斤"
                  - option "个"
                  - option "ml"
                  - option "l"
                  - option "把"
                  - option "根"
                  - option "块"
                - button "删除食材 白菜" [ref=f1e56] [cursor=pointer]: ×
          - generic [ref=f1e57]:
            - combobox "手动添加食材" [ref=f1e58]
            - button "＋ 添加" [disabled] [ref=f1e59]
        - generic [ref=f1e60]:
          - generic [ref=f1e61]:
            - heading "02 这一餐的偏好" [level=2] [ref=f1e62]:
              - generic [ref=f1e63]: "02"
              - text: 这一餐的偏好
            - button "常用偏好 ↗" [ref=f1e64] [cursor=pointer]
          - generic [ref=f1e65]:
            - generic [ref=f1e66]:
              - generic [ref=f1e67]: 几个人吃
              - button "1 人配菜参考 · 查看人数表" [ref=f1e68] [cursor=pointer]: 配菜参考 ↗
            - generic [ref=f1e69]:
              - button "减少人数" [ref=f1e70] [cursor=pointer]: −
              - spinbutton "几个人吃" [ref=f1e71]: "1"
              - button "增加人数" [ref=f1e72] [cursor=pointer]: ＋
          - group "今天的口味" [ref=f1e73]:
            - generic [ref=f1e75]:
              - button "不限" [pressed] [ref=f1e76] [cursor=pointer]
              - combobox "更多口味" [ref=f1e77]:
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
          - generic [ref=f1e78]:
            - button "过敏 未设置" [ref=f1e79] [cursor=pointer]:
              - generic [ref=f1e80]: 过敏
              - generic [ref=f1e81]:
                - text: 未设置
                - generic [aria-hidden] [ref=f1e82]: ›
            - button "忌口 未设置" [ref=f1e83] [cursor=pointer]:
              - generic [ref=f1e84]: 忌口
              - generic [ref=f1e85]:
                - text: 未设置
                - generic [aria-hidden] [ref=f1e86]: ›
            - button "调料 不限库存" [ref=f1e87] [cursor=pointer]:
              - generic [ref=f1e88]: 调料
              - generic [ref=f1e89]:
                - text: 不限库存
                - generic [aria-hidden] [ref=f1e90]: ›
          - generic [ref=f1e91] [cursor=pointer]:
            - checkbox "允许补买食材 列出更多菜谱，并标明需要补买什么" [checked] [ref=f1e92]
            - generic [ref=f1e93]:
              - text: 允许补买食材
              - generic [ref=f1e94]: 列出更多菜谱，并标明需要补买什么
          - button "安排这一餐" [ref=f1e96] [cursor=pointer]:
            - text: 看看可以做什么
            - generic [ref=f1e97]: ✧
      - region "本餐推荐" [ref=f1e98]:
        - generic [ref=f1e100]:
          - generic [ref=f1e101]: MADE FOR YOUR TABLE
          - heading "这一餐，安排好了" [level=2] [ref=f1e102]
        - generic [ref=f1e103]:
          - generic [ref=f1e104]:
            - strong [ref=f1e105]: 更多菜谱
            - generic [ref=f1e106]: 复用现有食材，缺少的列入补买清单 · 每页 6 道可选菜谱
          - generic [ref=f1e107]:
            - button "开始新一餐 ↻" [ref=f1e108] [cursor=pointer]
            - button "荤素汤搭配 ⌄" [ref=f1e109] [cursor=pointer]
        - paragraph [ref=f1e110]: 1 人用餐 · 按我的饮食要求 · 允许补买
        - status [ref=f1e111]:
          - strong [ref=f1e112]: 为你找到 4 道
        - generic [ref=f1e113]:
          - article [ref=f1e114]:
            - generic [ref=f1e115]:
              - img "鲤鱼炖白菜，配图暂不可用" [ref=f1e116]:
                - generic [ref=f1e117]: SHIWEI KITCHEN
                - strong [ref=f1e118]: 鲤鱼炖白菜
                - generic [ref=f1e119]: 配图暂不可用
              - button "收藏 鲤鱼炖白菜" [ref=f1e120] [cursor=pointer]
              - generic [ref=f1e123]: 咸鲜带辣
            - generic [ref=f1e124]:
              - generic [ref=f1e125]:
                - generic [ref=f1e126]: 荤菜
                - generic [ref=f1e127]: 家常菜
              - heading "鲤鱼炖白菜" [level=4] [ref=f1e128]
              - paragraph [ref=f1e129]: 鲤鱼 · 娃娃菜 · 白菜心 · 娃娃菜
              - group [ref=f1e130]:
                - generic "需要补买 1 项" [ref=f1e131] [cursor=pointer]:
                  - text: 需要补买
                  - generic [ref=f1e132]: 1 项
              - button "看看做法 ↗" [ref=f1e134] [cursor=pointer]
          - article [ref=f1e135]:
            - generic [ref=f1e136]:
              - img "乾隆白菜成品示意" [ref=f1e137]
              - button "收藏 乾隆白菜" [ref=f1e138] [cursor=pointer]
              - generic [ref=f1e141]: 麻酱酸甜
            - generic [ref=f1e142]:
              - generic [ref=f1e143]:
                - generic [ref=f1e144]: 素菜
                - generic [ref=f1e145]: 家常菜
                - generic [ref=f1e146]: 10 分钟
              - heading "乾隆白菜" [level=4] [ref=f1e147]
              - paragraph [ref=f1e148]: 白菜
              - button "看看做法 ↗" [ref=f1e150] [cursor=pointer]
          - article [ref=f1e151]:
            - generic [ref=f1e152]:
              - img "白菜猪肉炖粉条成品示意" [ref=f1e153]
              - button "收藏 白菜猪肉炖粉条" [ref=f1e154] [cursor=pointer]
              - generic [ref=f1e157]: 咸鲜
            - generic [ref=f1e158]:
              - generic [ref=f1e159]:
                - generic [ref=f1e160]: 荤菜
                - generic [ref=f1e161]: 家常菜
              - heading "白菜猪肉炖粉条" [level=4] [ref=f1e162]
              - paragraph [ref=f1e163]: 五花肉 · 白菜 · 土豆干粉条
              - group [ref=f1e164]:
                - generic "需要补买 2 项" [ref=f1e165] [cursor=pointer]:
                  - text: 需要补买
                  - generic [ref=f1e166]: 2 项
              - button "看看做法 ↗" [ref=f1e168] [cursor=pointer]
          - article [ref=f1e169]:
            - generic [ref=f1e170]:
              - img "上汤娃娃菜成品示意" [ref=f1e171]
              - button "收藏 上汤娃娃菜" [ref=f1e172] [cursor=pointer]
              - generic [ref=f1e175]: 咸鲜
            - generic [ref=f1e176]:
              - generic [ref=f1e177]:
                - generic [ref=f1e178]: 汤品
                - generic [ref=f1e179]: 家常菜
              - heading "上汤娃娃菜" [level=4] [ref=f1e180]
              - paragraph [ref=f1e181]: 娃娃菜 · 金针菇 · 皮蛋 · 午餐肉
              - group [ref=f1e182]:
                - generic "需要补买 2 项" [ref=f1e183] [cursor=pointer]:
                  - text: 需要补买
                  - generic [ref=f1e184]: 2 项
              - button "看看做法 ↗" [ref=f1e186] [cursor=pointer]
        - group [ref=f1e187]:
          - generic "本餐补买清单" [ref=f1e188] [cursor=pointer]
        - generic [ref=f1e189]:
          - button "上一页" [disabled] [ref=f1e190]
          - generic [ref=f1e191]: 1 / 1
          - button "下一页" [disabled] [ref=f1e192]
        - paragraph [ref=f1e193]: 菜谱用量供参考，请根据实际食材和人数调整。
  - contentinfo [ref=f1e194]:
    - generic [ref=f1e195]: 拾味 把日子，过得有滋有味。
    - generic [ref=f1e196]: 好好吃饭，好好生活。
  - button "看看可以做什么 1 种食材 · 1 人用餐" [ref=f1e198] [cursor=pointer]:
    - text: 看看可以做什么
    - generic [ref=f1e199]: 1 种食材 · 1 人用餐
```

# Test source

```ts
  1  | import { test,expect,type Page } from '@playwright/test';
  2  | import { readFile } from 'node:fs/promises';
  3  | import { defaultMeal } from '../shared/types';
  4  | const fixturesFile='.local-data/cloudbase-http/account-ingredients-20261024/fixtures.private.json';
  5  | async function visit(page:Page,path:string){
  6  |   await page.goto(path);
  7  |   const confirm=page.getByRole('button',{name:'确定访问',exact:true});
  8  |   await expect(confirm.or(page.locator('.site-header'))).toBeVisible();
  9  |   if(await confirm.isVisible())await confirm.click();
  10 |   await expect(page.locator('.site-header')).toBeVisible();
  11 | }
  12 | async function login(page:Page,fixture:{name:string;password:string}){
  13 |   await visit(page,'/?settings=1');
  14 |   await page.getByLabel('用户名',{exact:true}).fill(fixture.name);
  15 |   await page.getByLabel('密码',{exact:true}).fill(fixture.password);
  16 |   await page.getByRole('button',{name:'登录并同步',exact:true}).click();
  17 |   await expect(page.locator('.account-state')).toContainText(fixture.name);
  18 | }
  19 | 
  20 | test('卡片：图片显示口味、无序号和成品示意，补买清单默认收起且可展开',async({page},info)=>{
  21 |   await visit(page,'/');
  22 |   for(const name of ['白菜','猪肉','粉条','鸡蛋']){
  23 |     await page.getByLabel('手动添加食材',{exact:true}).fill(name);await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  24 |   }
> 25 |   await page.getByLabel('允许补买食材',{exact:false}).check();
     |                                                                   ^ Error: expect(locator).toHaveCount(expected) failed
  26 |   await page.locator('.generate-button').click();
  27 |   const cards=page.getByTestId('recipe-card');await expect(cards).toHaveCount(6);
  28 |   await expect(cards.locator('.card-number')).toHaveCount(0);
  29 |   await expect(cards.locator('.image-caption').first()).not.toContainText('成品示意');
  30 |   const card=cards.filter({has:page.locator('.shopping-list')}).first(),list=card.locator('.shopping-list');
  31 |   await expect(list).not.toHaveAttribute('open');
  32 |   await expect(list.locator('.checks')).not.toBeVisible();
  33 |   await list.locator('summary').click();await expect(list.locator('.checks')).toBeVisible();
  34 |   await list.locator('summary').click();await expect(list.locator('.checks')).not.toBeVisible();
  35 |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  36 |   await card.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('compact-cards.png'),fullPage:true});
  37 | });
  38 | 
  39 | test('账户：游客确认合并、第二设备读取、并发冲突确认、账号隔离、退出撤销',async({page,browser,baseURL},info)=>{
  40 |   test.setTimeout(180000);
  41 |   const fixtures=JSON.parse(await readFile(fixturesFile,'utf8')) as {name:string;password:string}[];
  42 |   // Reset only the two synthetic acceptance accounts, through their ordinary CAS API.
  43 |   const initial=await page.request.get('/api/v1/auth/session');let csrf=(await initial.json()).csrfToken;
  44 |   for(const fixture of fixtures){
  45 |     await page.request.post('/api/v1/auth/login',{headers:{Origin:baseURL!,'x-csrf-token':csrf},data:{username:fixture.name,password:fixture.password}});
  46 |     const current=await(await page.request.get('/api/v1/account/state')).json();
  47 |     await page.request.post('/api/v1/account/state',{headers:{Origin:baseURL!,'x-csrf-token':csrf},data:{expectedVersion:current.version,value:{favorites:[],defaults:null}}});
  48 |     await page.request.post('/api/v1/auth/logout',{headers:{Origin:baseURL!,'x-csrf-token':csrf},data:{}});
  49 |   }
  50 |   const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json(),first=catalog.recipes.find((r:any)=>r.name==='冬瓜酿肉');
  51 |   await visit(page,'/');
  52 |   await page.evaluate(({favorite,defaults})=>{
  53 |     localStorage.setItem('shiwei:guest:favorites:v1',JSON.stringify([favorite]));
  54 |     localStorage.setItem('shiwei:guest:defaults:v1',JSON.stringify(defaults));
  55 |   },{favorite:{recipeId:first.id,variantId:first.variants[0].id},defaults:{...defaultMeal(),restrictions:[{id:'test-peanut',kind:'allergy',name:'花生',targets:['peanut'],scope:'self',status:'confirmed',original:'构造验收花生过敏'}]}});
  56 |   await login(page,fixtures[0]);
  57 |   await expect(page.locator('.sync-review')).toContainText('冬瓜酿肉');await expect(page.locator('.sync-review')).toContainText('花生');
  58 |   await page.getByRole('button',{name:'合并并同步',exact:true}).click();await expect(page.locator('.sync-review')).toHaveCount(0);
  59 |   await visit(page,'/recipes?q='+encodeURIComponent('冬瓜酿肉'));
  60 |   const other=await browser.newContext({baseURL,viewport:page.viewportSize()!,locale:'zh-CN'}),b=await other.newPage();
  61 |   const third=await browser.newContext({baseURL,viewport:page.viewportSize()!,locale:'zh-CN'}),c=await third.newPage();
  62 |   try{
  63 |     await login(b,fixtures[0]);
  64 |     const secondState=await(await b.request.get('/api/v1/account/state')).json();
  65 |     expect(secondState.value.favorites).toHaveLength(1);expect(secondState.value.defaults.restrictions[0].name).toBe('花生');
  66 |     await visit(b,'/recipes?q='+encodeURIComponent('上汤娃娃菜'));
  67 |     const removed=page.waitForResponse(r=>r.url().endsWith('/api/v1/account/state')&&r.request().method()==='POST');
  68 |     await page.locator('.candidate-card').getByRole('button',{name:/取消收藏/}).click();expect((await removed).status()).toBe(200);
  69 |     const conflict=b.waitForResponse(r=>r.url().endsWith('/api/v1/account/state')&&r.request().method()==='POST');
  70 |     await b.locator('.candidate-card').getByRole('button',{name:/^收藏 /}).click();expect((await conflict).status()).toBe(409);
  71 |     await expect(b.locator('.account-sync-banner')).toContainText('核对');
  72 |     await b.locator('.account-sync-banner').getByRole('link').click();await expect(b.locator('.sync-review')).toBeVisible();
  73 |     await b.getByRole('button',{name:'使用账户内容',exact:true}).click();await expect(b.locator('.sync-review')).toHaveCount(0);
  74 |     await login(c,fixtures[1]);
  75 |     const isolated=await(await c.request.get('/api/v1/account/state')).json();expect(isolated.value.favorites).toHaveLength(0);expect(isolated.value.defaults).toBeNull();
  76 |     await page.goto('/?settings=1');await expect(page.locator('.account-state')).toBeVisible();
  77 |     await page.getByRole('button',{name:'退出登录',exact:true}).click();
  78 |     await expect(page.getByRole('button',{name:'登录并同步',exact:true})).toBeVisible();
  79 |     expect((await page.request.get('/api/v1/account/state')).status()).toBe(401);
  80 |     await b.screenshot({path:info.outputPath('account-sync.png'),fullPage:true});
  81 |   }finally{await other.close();await third.close();}
  82 | });
  83 | 
```