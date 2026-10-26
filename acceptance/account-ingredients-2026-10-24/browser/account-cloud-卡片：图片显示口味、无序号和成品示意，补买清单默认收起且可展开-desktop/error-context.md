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
    8 × locator resolved to 0 elements
      - unexpected value "0"
    35 × locator resolved to 4 elements
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
      - link "我的收藏 0" [ref=f1e12] [cursor=pointer]:
        - /url: /favorites
        - text: 我的收藏
        - generic [ref=f1e13]: "0"
    - button "个人设置" [ref=f1e15] [cursor=pointer]: 我
  - main [ref=f1e16]:
    - generic [ref=f1e17]:
      - generic [ref=f1e18]:
        - generic [ref=f1e19]: A LITTLE INSPIRATION, EVERY DAY
        - heading "今天，吃点什么？" [level=1] [ref=f1e20]:
          - text: 今天，吃点什么？
          - generic [aria-hidden] [ref=f1e21]: ✳
        - paragraph [ref=f1e22]: 打开冰箱，把手边的食材变成一顿好饭。
      - button "健康模式 了解健康推荐" [ref=f1e23] [cursor=pointer]:
        - generic [aria-hidden] [ref=f1e24]: ♡
        - generic [ref=f1e25]:
          - strong [ref=f1e26]: 健康模式
          - generic [ref=f1e27]: 了解健康推荐
    - generic [ref=f1e29]:
      - generic [ref=f1e30]:
        - generic [ref=f1e31]: 少一点纠结，多一点烟火气
        - heading "有啥，做啥。 好好吃一餐。" [level=2] [ref=f1e33]: 有啥，做啥。好好吃一餐。
        - paragraph [ref=f1e34]: 食材不浪费，搭配刚刚好。
      - img "番茄炒蛋、时蔬和汤的家常餐食示意" [ref=f1e35]:
        - generic [ref=f1e36]: 家常滋味 · 图片为示意
      - generic [aria-hidden] [ref=f1e37]: ✳
    - generic [ref=f1e38]:
      - generic [ref=f1e39]:
        - generic [ref=f1e40]:
          - generic [ref=f1e41]:
            - heading "01 看看有什么食材" [level=2] [ref=f1e42]:
              - generic [ref=f1e43]: "01"
              - text: 看看有什么食材
            - generic [ref=f1e44]: 1 种
          - group "输入方式" [ref=f1e45]:
            - button "拍照 / 上传" [pressed] [ref=f1e46] [cursor=pointer]
            - button "文字输入" [ref=f1e47] [cursor=pointer]
          - generic [ref=f1e48]:
            - strong [ref=f1e49]: 我的食材
            - generic [ref=f1e50]: 用量选填
          - paragraph [ref=f1e51]: 填写用量，搭配菜数和补买建议会更精确。
          - list "我的食材" [ref=f1e52]:
            - listitem [ref=f1e53]:
              - generic [ref=f1e54]:
                - generic "白菜" [ref=f1e55]
                - textbox "白菜用量" [ref=f1e56]:
                  - /placeholder: 选填
                - combobox "白菜单位" [ref=f1e57]:
                  - option "g" [selected]
                  - option "kg"
                  - option "斤"
                  - option "个"
                  - option "ml"
                  - option "l"
                  - option "把"
                  - option "根"
                  - option "块"
                - button "删除食材 白菜" [ref=f1e58] [cursor=pointer]: ×
          - generic [ref=f1e59]:
            - combobox "手动添加食材" [ref=f1e60]
            - button "＋ 添加" [disabled] [ref=f1e61]
        - generic [ref=f1e62]:
          - generic [ref=f1e63]:
            - heading "02 这一餐的偏好" [level=2] [ref=f1e64]:
              - generic [ref=f1e65]: "02"
              - text: 这一餐的偏好
            - button "常用偏好 ↗" [ref=f1e66] [cursor=pointer]
          - generic [ref=f1e67]:
            - generic [ref=f1e68]:
              - generic [ref=f1e69]: 几个人吃
              - button "1 人配菜参考 · 查看人数表" [ref=f1e70] [cursor=pointer]: 配菜参考 ↗
            - generic [ref=f1e71]:
              - button "减少人数" [ref=f1e72] [cursor=pointer]: −
              - spinbutton "几个人吃" [ref=f1e73]: "1"
              - button "增加人数" [ref=f1e74] [cursor=pointer]: ＋
          - group "今天的口味" [ref=f1e75]:
            - generic [ref=f1e77]:
              - button "不限" [pressed] [ref=f1e78] [cursor=pointer]
              - combobox "更多口味" [ref=f1e79]:
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
          - generic [ref=f1e80]:
            - button "过敏 未设置" [ref=f1e81] [cursor=pointer]:
              - generic [ref=f1e82]: 过敏
              - generic [ref=f1e83]:
                - text: 未设置
                - generic [aria-hidden] [ref=f1e84]: ›
            - button "忌口 未设置" [ref=f1e85] [cursor=pointer]:
              - generic [ref=f1e86]: 忌口
              - generic [ref=f1e87]:
                - text: 未设置
                - generic [aria-hidden] [ref=f1e88]: ›
            - button "调料 不限库存" [ref=f1e89] [cursor=pointer]:
              - generic [ref=f1e90]: 调料
              - generic [ref=f1e91]:
                - text: 不限库存
                - generic [aria-hidden] [ref=f1e92]: ›
          - generic [ref=f1e93] [cursor=pointer]:
            - checkbox "允许补买食材 列出更多菜谱，并标明需要补买什么" [checked] [ref=f1e94]
            - generic [ref=f1e95]:
              - text: 允许补买食材
              - generic [ref=f1e96]: 列出更多菜谱，并标明需要补买什么
          - button "安排这一餐" [ref=f1e98] [cursor=pointer]:
            - text: 看看可以做什么
            - generic [ref=f1e99]: ✧
      - region "本餐推荐" [ref=f1e100]:
        - generic [ref=f1e101]:
          - generic [ref=f1e102]:
            - generic [ref=f1e103]: MADE FOR YOUR TABLE
            - heading "这一餐，安排好了" [level=2] [ref=f1e104]
          - generic [ref=f1e105]: 从手边食材开始
        - generic [ref=f1e106]:
          - generic [ref=f1e107]:
            - strong [ref=f1e108]: 更多菜谱
            - generic [ref=f1e109]: 复用现有食材，缺少的列入补买清单 · 每页 6 道可选菜谱
          - generic [ref=f1e110]:
            - button "开始新一餐 ↻" [ref=f1e111] [cursor=pointer]
            - button "荤素汤搭配 ⌄" [ref=f1e112] [cursor=pointer]
        - paragraph [ref=f1e113]: 1 人用餐 · 按我的饮食要求 · 允许补买
        - status [ref=f1e114]:
          - strong [ref=f1e115]: 为你找到 4 道
        - generic [ref=f1e116]:
          - article [ref=f1e117]:
            - generic [ref=f1e118]:
              - img "鲤鱼炖白菜，配图暂不可用" [ref=f1e119]:
                - generic [ref=f1e120]: SHIWEI KITCHEN
                - strong [ref=f1e121]: 鲤鱼炖白菜
                - generic [ref=f1e122]: 配图暂不可用
              - button "收藏 鲤鱼炖白菜" [ref=f1e123] [cursor=pointer]
              - generic [ref=f1e126]: 咸鲜带辣
            - generic [ref=f1e127]:
              - generic [ref=f1e128]:
                - generic [ref=f1e129]: 荤菜
                - generic [ref=f1e130]: 家常菜
              - heading "鲤鱼炖白菜" [level=4] [ref=f1e131]
              - paragraph [ref=f1e132]: 鲤鱼 · 娃娃菜 · 白菜心 · 娃娃菜
              - group [ref=f1e133]:
                - generic "需要补买 1 项" [ref=f1e134] [cursor=pointer]:
                  - text: 需要补买
                  - generic [ref=f1e135]: 1 项
              - button "看看做法 ↗" [ref=f1e137] [cursor=pointer]
          - article [ref=f1e138]:
            - generic [ref=f1e139]:
              - img "乾隆白菜成品示意" [ref=f1e140]
              - button "收藏 乾隆白菜" [ref=f1e141] [cursor=pointer]
              - generic [ref=f1e144]: 麻酱酸甜
            - generic [ref=f1e145]:
              - generic [ref=f1e146]:
                - generic [ref=f1e147]: 素菜
                - generic [ref=f1e148]: 家常菜
                - generic [ref=f1e149]: 10 分钟
              - heading "乾隆白菜" [level=4] [ref=f1e150]
              - paragraph [ref=f1e151]: 白菜
              - button "看看做法 ↗" [ref=f1e153] [cursor=pointer]
          - article [ref=f1e154]:
            - generic [ref=f1e155]:
              - img "白菜猪肉炖粉条成品示意" [ref=f1e156]
              - button "收藏 白菜猪肉炖粉条" [ref=f1e157] [cursor=pointer]
              - generic [ref=f1e160]: 咸鲜
            - generic [ref=f1e161]:
              - generic [ref=f1e162]:
                - generic [ref=f1e163]: 荤菜
                - generic [ref=f1e164]: 家常菜
              - heading "白菜猪肉炖粉条" [level=4] [ref=f1e165]
              - paragraph [ref=f1e166]: 五花肉 · 白菜 · 土豆干粉条
              - group [ref=f1e167]:
                - generic "需要补买 2 项" [ref=f1e168] [cursor=pointer]:
                  - text: 需要补买
                  - generic [ref=f1e169]: 2 项
              - button "看看做法 ↗" [ref=f1e171] [cursor=pointer]
          - article [ref=f1e172]:
            - generic [ref=f1e173]:
              - img "上汤娃娃菜成品示意" [ref=f1e174]
              - button "收藏 上汤娃娃菜" [ref=f1e175] [cursor=pointer]
              - generic [ref=f1e178]: 咸鲜
            - generic [ref=f1e179]:
              - generic [ref=f1e180]:
                - generic [ref=f1e181]: 汤品
                - generic [ref=f1e182]: 家常菜
              - heading "上汤娃娃菜" [level=4] [ref=f1e183]
              - paragraph [ref=f1e184]: 娃娃菜 · 金针菇 · 皮蛋 · 午餐肉
              - group [ref=f1e185]:
                - generic "需要补买 2 项" [ref=f1e186] [cursor=pointer]:
                  - text: 需要补买
                  - generic [ref=f1e187]: 2 项
              - button "看看做法 ↗" [ref=f1e189] [cursor=pointer]
        - group [ref=f1e190]:
          - generic "本餐补买清单" [ref=f1e191] [cursor=pointer]
        - generic [ref=f1e192]:
          - button "上一页" [disabled] [ref=f1e193]
          - generic [ref=f1e194]: 1 / 1
          - button "下一页" [disabled] [ref=f1e195]
        - paragraph [ref=f1e196]: 菜谱用量供参考，请根据实际食材和人数调整。
  - contentinfo [ref=f1e197]:
    - generic [ref=f1e198]: 拾味 把日子，过得有滋有味。
    - generic [ref=f1e199]: 好好吃饭，好好生活。
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
  22 |   await page.getByLabel('手动添加食材',{exact:true}).fill('白菜');await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  23 |   await page.getByLabel('允许补买食材',{exact:false}).check();
  24 |   await page.locator('.generate-button').click();
> 25 |   const cards=page.getByTestId('recipe-card');await expect(cards).toHaveCount(6);
     |                                                                   ^ Error: expect(locator).toHaveCount(expected) failed
  26 |   await expect(cards.locator('.card-number')).toHaveCount(0);
  27 |   await expect(cards.locator('.image-caption').first()).not.toContainText('成品示意');
  28 |   const card=cards.filter({has:page.locator('.shopping-list')}).first(),list=card.locator('.shopping-list');
  29 |   await expect(list).not.toHaveAttribute('open');
  30 |   await expect(list.locator('.checks')).not.toBeVisible();
  31 |   await list.locator('summary').click();await expect(list.locator('.checks')).toBeVisible();
  32 |   await list.locator('summary').click();await expect(list.locator('.checks')).not.toBeVisible();
  33 |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  34 |   await card.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('compact-cards.png'),fullPage:true});
  35 | });
  36 | 
  37 | test('账户：游客确认合并、第二设备读取、并发冲突确认、账号隔离、退出撤销',async({page,browser,baseURL},info)=>{
  38 |   test.setTimeout(180000);
  39 |   const fixtures=JSON.parse(await readFile(fixturesFile,'utf8')) as {name:string;password:string}[];
  40 |   // Reset only the two synthetic acceptance accounts, through their ordinary CAS API.
  41 |   const initial=await page.request.get('/api/v1/auth/session');let csrf=(await initial.json()).csrfToken;
  42 |   for(const fixture of fixtures){
  43 |     await page.request.post('/api/v1/auth/login',{headers:{Origin:baseURL!,'x-csrf-token':csrf},data:{username:fixture.name,password:fixture.password}});
  44 |     const current=await(await page.request.get('/api/v1/account/state')).json();
  45 |     await page.request.post('/api/v1/account/state',{headers:{Origin:baseURL!,'x-csrf-token':csrf},data:{expectedVersion:current.version,value:{favorites:[],defaults:null}}});
  46 |     await page.request.post('/api/v1/auth/logout',{headers:{Origin:baseURL!,'x-csrf-token':csrf},data:{}});
  47 |   }
  48 |   const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json(),first=catalog.recipes.find((r:any)=>r.name==='冬瓜酿肉');
  49 |   await visit(page,'/');
  50 |   await page.evaluate(({favorite,defaults})=>{
  51 |     localStorage.setItem('shiwei:guest:favorites:v1',JSON.stringify([favorite]));
  52 |     localStorage.setItem('shiwei:guest:defaults:v1',JSON.stringify(defaults));
  53 |   },{favorite:{recipeId:first.id,variantId:first.variants[0].id},defaults:{...defaultMeal(),restrictions:[{id:'test-peanut',kind:'allergy',name:'花生',targets:['peanut'],scope:'self',status:'confirmed',original:'构造验收花生过敏'}]}});
  54 |   await login(page,fixtures[0]);
  55 |   await expect(page.locator('.sync-review')).toContainText('冬瓜酿肉');await expect(page.locator('.sync-review')).toContainText('花生');
  56 |   await page.getByRole('button',{name:'合并并同步',exact:true}).click();await expect(page.locator('.sync-review')).toHaveCount(0);
  57 |   await visit(page,'/recipes?q='+encodeURIComponent('冬瓜酿肉'));
  58 |   const other=await browser.newContext({baseURL,viewport:page.viewportSize()!,locale:'zh-CN'}),b=await other.newPage();
  59 |   const third=await browser.newContext({baseURL,viewport:page.viewportSize()!,locale:'zh-CN'}),c=await third.newPage();
  60 |   try{
  61 |     await login(b,fixtures[0]);
  62 |     const secondState=await(await b.request.get('/api/v1/account/state')).json();
  63 |     expect(secondState.value.favorites).toHaveLength(1);expect(secondState.value.defaults.restrictions[0].name).toBe('花生');
  64 |     await visit(b,'/recipes?q='+encodeURIComponent('上汤娃娃菜'));
  65 |     const removed=page.waitForResponse(r=>r.url().endsWith('/api/v1/account/state')&&r.request().method()==='POST');
  66 |     await page.locator('.candidate-card').getByRole('button',{name:/取消收藏/}).click();expect((await removed).status()).toBe(200);
  67 |     const conflict=b.waitForResponse(r=>r.url().endsWith('/api/v1/account/state')&&r.request().method()==='POST');
  68 |     await b.locator('.candidate-card').getByRole('button',{name:/^收藏 /}).click();expect((await conflict).status()).toBe(409);
  69 |     await expect(b.locator('.account-sync-banner')).toContainText('核对');
  70 |     await b.locator('.account-sync-banner').getByRole('link').click();await expect(b.locator('.sync-review')).toBeVisible();
  71 |     await b.getByRole('button',{name:'使用账户内容',exact:true}).click();await expect(b.locator('.sync-review')).toHaveCount(0);
  72 |     await login(c,fixtures[1]);
  73 |     const isolated=await(await c.request.get('/api/v1/account/state')).json();expect(isolated.value.favorites).toHaveLength(0);expect(isolated.value.defaults).toBeNull();
  74 |     await page.goto('/?settings=1');await expect(page.locator('.account-state')).toBeVisible();
  75 |     await page.getByRole('button',{name:'退出登录',exact:true}).click();
  76 |     await expect(page.getByRole('button',{name:'登录并同步',exact:true})).toBeVisible();
  77 |     expect((await page.request.get('/api/v1/account/state')).status()).toBe(401);
  78 |     await b.screenshot({path:info.outputPath('account-sync.png'),fullPage:true});
  79 |   }finally{await other.close();await third.close();}
  80 | });
  81 | 
```