# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: registration-browser.spec.ts >> 个人设置自动保存恢复：不重载页面，不同步人数或草稿，游客不能保存账户设置
- Location: tests\registration-browser.spec.ts:60:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - link "跳到本餐工作台" [ref=e3] [cursor=pointer]:
    - /url: "#workspace"
  - banner [ref=e4]:
    - link "拾味首页" [ref=e5] [cursor=pointer]:
      - /url: /
      - generic [ref=e6]: 拾
      - generic [ref=e7]:
        - text: 拾味
        - generic [ref=e8]: SHIWEI KITCHEN
    - navigation "主导航" [ref=e9]:
      - link "做饭工作台" [ref=e10] [cursor=pointer]:
        - /url: /#workspace
      - link "菜谱图鉴" [ref=e11] [cursor=pointer]:
        - /url: /recipes
      - link "我的收藏" [ref=e12] [cursor=pointer]:
        - /url: /favorites
    - button "个人设置" [ref=e14] [cursor=pointer]: 我
  - main [ref=e15]:
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: A LITTLE INSPIRATION, EVERY DAY
        - heading "今天，吃点什么？" [level=1] [ref=e19]:
          - text: 今天，吃点什么？
          - generic [aria-hidden] [ref=e20]: ✳
        - paragraph [ref=e21]: 打开冰箱，把手边的食材变成一顿好饭。
      - button [ref=e22] [cursor=pointer]:
        - generic [aria-hidden] [ref=e23]: ♡
        - strong [ref=e25]: 健康模式
    - generic [ref=e27]:
      - generic [ref=e28]:
        - generic [ref=e29]: 少一点纠结，多一点烟火气
        - heading "有啥，做啥。 好好吃一餐。" [level=2] [ref=e31]: 有啥，做啥。好好吃一餐。
        - paragraph [ref=e32]: 食材不浪费，搭配刚刚好。
      - img "番茄炒蛋、时蔬和汤的家常餐食示意" [ref=e33]:
        - generic [ref=e34]: 家常滋味 · 图片为示意
      - generic [aria-hidden] [ref=e35]: ✳
    - generic [ref=e36]:
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]:
            - heading "01 看看有什么食材" [level=2] [ref=e40]:
              - generic [ref=e41]: "01"
              - text: 看看有什么食材
            - generic [ref=e42]: 0 种
          - group "输入方式" [ref=e43]:
            - button "拍照 / 上传" [pressed] [ref=e44] [cursor=pointer]
            - button "文字输入" [ref=e45] [cursor=pointer]
          - generic [ref=e46]:
            - strong [ref=e52]: 拍下食材，灵感就来了
            - generic [ref=e53]: 图片识别暂不可用，请使用文字或手动添加
            - generic [ref=e54]:
              - generic [ref=e55]:
                - button "选择图片" [ref=e56] [cursor=pointer]
                - button "手机拍照" [ref=e57] [cursor=pointer]
              - paragraph [ref=e58]: 图片仅在本页预览；识别暂不可用，请用文字或手动添加食材。手机拍照由设备支持情况决定。
            - button "转到文字录入 →" [ref=e59] [cursor=pointer]
          - generic [ref=e60]:
            - strong [ref=e61]: 我的食材
            - generic [ref=e62]: 用量选填
          - paragraph [ref=e63]: 填写用量，搭配菜数和补买建议会更精确。
          - generic [ref=e64]: 添加现有食材，或允许补买查看默认推荐
          - list "我的食材"
          - generic [ref=e65]:
            - combobox "手动添加食材" [ref=e66]
            - button "＋ 添加" [disabled] [ref=e67]
        - generic [ref=e68]:
          - generic [ref=e69]:
            - heading "02 这一餐的偏好" [level=2] [ref=e70]:
              - generic [ref=e71]: "02"
              - text: 这一餐的偏好
            - button "个人设置 ↗" [ref=e72] [cursor=pointer]
          - generic [ref=e73]:
            - generic [ref=e74]:
              - generic [ref=e75]: 几个人吃
              - button "1 人配菜参考 · 查看人数表" [ref=e76] [cursor=pointer]: 配菜参考 ↗
            - generic [ref=e77]:
              - button "减少人数" [ref=e78] [cursor=pointer]: −
              - spinbutton "几个人吃" [ref=e79]: "1"
              - button "增加人数" [ref=e80] [cursor=pointer]: ＋
          - group "今天的口味" [ref=e81]:
            - generic [ref=e83]:
              - button "不限" [pressed] [ref=e84] [cursor=pointer]
              - button "清淡" [ref=e85] [cursor=pointer]
              - button "微辣" [ref=e86] [cursor=pointer]
              - combobox "更多口味" [ref=e87]:
                - option "更多" [selected]
          - generic [ref=e88]:
            - button "过敏 未设置" [ref=e89] [cursor=pointer]:
              - generic [ref=e90]: 过敏
              - generic [ref=e91]:
                - text: 未设置
                - generic [aria-hidden] [ref=e92]: ›
            - button "忌口 未设置" [ref=e93] [cursor=pointer]:
              - generic [ref=e94]: 忌口
              - generic [ref=e95]:
                - text: 未设置
                - generic [aria-hidden] [ref=e96]: ›
            - button "调料 不限库存" [ref=e97] [cursor=pointer]:
              - generic [ref=e98]: 调料
              - generic [ref=e99]:
                - text: 不限库存
                - generic [aria-hidden] [ref=e100]: ›
          - generic [ref=e101] [cursor=pointer]:
            - checkbox "允许补买食材 只用现有食材，直接搭配一餐" [ref=e102]
            - generic [ref=e103]:
              - text: 允许补买食材
              - generic [ref=e104]: 只用现有食材，直接搭配一餐
          - button "安排这一餐" [ref=e106] [cursor=pointer]:
            - text: 搭配这一餐
            - generic [ref=e107]: ✧
      - region "本餐推荐" [ref=e108]:
        - generic [ref=e110]:
          - generic [ref=e111]: MADE FOR YOUR TABLE
          - heading "这一餐，安排好了" [level=2] [ref=e112]
        - generic [ref=e113]:
          - generic [ref=e114]:
            - strong [ref=e115]: 一键搭配
            - generic [ref=e116]: 按人数、食材种类和用量灵活搭配
          - generic [ref=e117]:
            - button "开始新一餐 ↻" [ref=e118] [cursor=pointer]
            - button "荤素汤搭配 ⌄" [ref=e119] [cursor=pointer]
        - generic [ref=e120]:
          - generic [aria-hidden] [ref=e121]: ✳ 🥬
          - heading "好好吃饭，从手边开始" [level=3] [ref=e122]
          - paragraph [ref=e123]: 添加手边食材，选好口味，让我们把这一餐搭配好。
          - generic [ref=e124]:
            - generic [ref=e125]:
              - generic [ref=e126]: "1"
              - text: 添加食材
            - generic [ref=e127]:
              - generic [ref=e128]: "2"
              - text: 搭配一餐
            - generic [ref=e129]:
              - generic [ref=e130]: "3"
              - text: 照着做就好
  - contentinfo [ref=e131]:
    - generic [ref=e132]: 拾味 把日子，过得有滋有味。
    - generic [ref=e133]: 好好吃饭，好好生活。
  - button "搭配这一餐 0 种食材 · 1 人用餐" [ref=e135] [cursor=pointer]:
    - text: 搭配这一餐
    - generic [ref=e136]: 0 种食材 · 1 人用餐
  - dialog [ref=e137]:
    - generic [ref=e138]:
      - heading "个人设置" [level=2] [ref=e139]
      - button "关闭弹层" [ref=e140] [cursor=pointer]: ×
    - generic [ref=e141]:
      - paragraph [ref=e142]: 口味、过敏、忌口和调料会自动保存。
      - heading "账号" [level=3] [ref=e143]
      - generic [ref=e144]:
        - paragraph [ref=e145]: 已登录 · settings-mobile
        - status [active] [ref=e146]: 注册成功，已登录。
        - button "修改密码" [ref=e147] [cursor=pointer]
        - button "退出登录" [ref=e148] [cursor=pointer]
```

# Test source

```ts
  1   | import {test,expect,type Page} from '@playwright/test';
  2   | import { defaultMeal } from '../shared/types';
  3   | test('自助注册：无需邀请、错误码可重试、自动同步、刷新/换设备恢复与新账号隔离',async({page,browser},info)=>{
  4   |   const username=`signup-${info.project.name}`,password='Ab1!xyZ9';
  5   |   await page.goto('/?settings=1');
  6   |   const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json(),recipe=catalog.recipes[0];
  7   |   await page.evaluate(({recipe,defaults})=>{
  8   |     localStorage.setItem('shiwei:guest:favorites:v1',JSON.stringify([{recipeId:recipe.id,variantId:recipe.variants[0].id}]));
  9   |     localStorage.setItem('shiwei:guest:defaults:v1',JSON.stringify(defaults));
  10  |   },{recipe,defaults:{...defaultMeal(),servings:2}});await page.reload();
  11  |   await page.getByRole('button',{name:'注册账号',exact:true}).click();
  12  |   await expect(page.locator('.account-form')).not.toContainText('受邀');
  13  |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  14  |   await page.screenshot({path:info.outputPath('registration-form.png'),fullPage:true});
  15  |   const signup=async(target:Page,name:string,wrongCode=false)=>{
  16  |     await target.getByLabel('用户名',{exact:true}).fill(name);await target.getByLabel('邮箱',{exact:true}).fill(`${name}@example.invalid`);
  17  |     if(wrongCode)await target.route('**/api/v1/auth/registration/code',route=>route.fulfill({status:400,json:{error:{code:'CAPTCHA_REQUIRED',message:'请先完成图片验证后重试'}}}),{times:1});
  18  |     await target.getByRole('button',{name:'获取验证码',exact:true}).click();
  19  |     if(wrongCode){await expect(target.getByAltText('图片验证码',{exact:true})).toBeVisible();await target.getByLabel('图片验证码',{exact:true}).fill('AB12');await target.getByRole('button',{name:'获取验证码',exact:true}).click();}
  20  |     await expect(target.locator('.account-form')).toContainText('验证码已发送');
  21  |     await expect(target.getByRole('button',{name:/秒后重发/})).toBeDisabled();
  22  |     const submit=async(code:string)=>{
  23  |       await target.getByLabel('邮箱验证码',{exact:true}).fill(code);await target.getByLabel('密码',{exact:true}).fill(password);await target.getByLabel('确认密码',{exact:true}).fill(password);
  24  |       await target.getByRole('button',{name:'注册并登录',exact:true}).click();
  25  |     };
  26  |     if(wrongCode){
  27  |       await submit('000000');
  28  |       const error=target.getByRole('alert').filter({hasText:'邮箱验证码不正确'});await expect(error).toBeInViewport();await expect(error).toBeFocused();
  29  |       await expect(target.getByLabel('密码',{exact:true})).toHaveValue(password);await expect(target.getByLabel('确认密码',{exact:true})).toHaveValue(password);
  30  |       await expect(target.getByLabel('邮箱验证码',{exact:true})).toHaveValue('000000');
  31  |       await target.screenshot({path:info.outputPath('registration-error-visible.png'),fullPage:true});
  32  |       // A retry needs only the corrected code; both password fields must survive.
  33  |       await target.getByLabel('邮箱验证码',{exact:true}).fill('123456');await target.getByRole('button',{name:'注册并登录',exact:true}).click();
  34  |     }else await submit('123456');
  35  |     await expect(target.locator('.account-state')).toContainText(name);
  36  |     await expect(target.getByRole('status').filter({hasText:'注册成功，已登录'})).toBeInViewport();
  37  |     await expect(target.getByText('首次登录请修改初始密码，再同步个人资料。',{exact:true})).toHaveCount(0);
  38  |   };
  39  |   await signup(page,username,true);
  40  |   await expect(page.locator('.sync-review')).toHaveCount(0);
  41  |   await page.reload();await expect(page.locator('.account-state')).toContainText(username);
  42  |   const saved=await(await page.request.get('/api/v1/account/state')).json();expect(saved.value.favorites).toHaveLength(1);expect(saved.value.defaults.servings).toBe(1);
  43  |   const second=await browser.newContext(),other=await browser.newContext();
  44  |   try{
  45  |     const secondPage=await second.newPage();await secondPage.goto('http://127.0.0.1:4178/?settings=1');
  46  |     await secondPage.route('**/api/v1/auth/login',route=>route.fulfill({status:400,json:{error:{code:'CAPTCHA_REQUIRED',message:'请先完成图片验证后重试'}}}),{times:1});
  47  |     await secondPage.getByLabel('用户名',{exact:true}).fill(username);await secondPage.getByLabel('密码',{exact:true}).fill(password);await secondPage.getByRole('button',{name:'登录并同步',exact:true}).click();
  48  |     await expect(secondPage.getByAltText('图片验证码',{exact:true})).toBeVisible();await secondPage.getByLabel('图片验证码',{exact:true}).fill('AB12');await secondPage.getByLabel('密码',{exact:true}).fill(password);await secondPage.getByRole('button',{name:'登录并同步',exact:true}).click();
  49  |     await expect(secondPage.locator('.account-state')).toContainText(username);
  50  |     await expect(secondPage.getByRole('status').filter({hasText:'登录成功。'})).toBeInViewport();
  51  |     const restored=await(await secondPage.request.get('/api/v1/account/state')).json();expect(restored.value).toEqual(saved.value);
  52  |     const otherPage=await other.newPage();await otherPage.goto('http://127.0.0.1:4178/?settings=1');await otherPage.getByRole('button',{name:'注册账号',exact:true}).click();await signup(otherPage,`${username}-b`);
  53  |     const separate=await(await otherPage.request.get('/api/v1/account/state')).json();expect(separate.value.favorites).toEqual([]);expect(separate.value.defaults.restrictions).toEqual([]);
  54  |     const firstSession=await(await secondPage.request.get('/api/v1/auth/session')).json(),otherSession=await(await otherPage.request.get('/api/v1/auth/session')).json();expect(firstSession.userId).not.toBe(otherSession.userId);
  55  |     await otherPage.getByRole('button',{name:'退出登录',exact:true}).click();await expect(otherPage.getByRole('button',{name:'登录并同步',exact:true})).toBeVisible();
  56  |     expect((await otherPage.request.get('/api/v1/account/state')).status()).toBe(401);
  57  |   }finally{await second.close();await other.close();}
  58  | });
  59  | 
  60  | test('个人设置自动保存恢复：不重载页面，不同步人数或草稿，游客不能保存账户设置',async({page,browser},info)=>{
  61  |   await page.goto('/?settings=1');
  62  |   await expect(page.getByText('登录后可保存个人设置。',{exact:true})).toBeVisible();
  63  |   await expect(page.getByRole('button',{name:'保存为常用偏好',exact:true})).toHaveCount(0);
  64  |   const name=`settings-${info.project.name}`;
  65  |   await page.getByRole('button',{name:'注册账号',exact:true}).click();
  66  |   await page.getByLabel('用户名',{exact:true}).fill(name);await page.getByLabel('邮箱',{exact:true}).fill(`${name}@example.invalid`);
  67  |   await page.getByRole('button',{name:'获取验证码',exact:true}).click();await expect(page.locator('.account-form')).toContainText('验证码已发送');
  68  |   await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');await page.getByLabel('密码',{exact:true}).fill('Ab1!xyZ9');await page.getByLabel('确认密码',{exact:true}).fill('Ab1!xyZ9');
  69  |   let navigations=0,catalogRequests=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});page.on('request',r=>{if(r.url().includes('/catalog/recipes'))catalogRequests++;});
  70  |   await page.getByRole('button',{name:'注册并登录',exact:true}).click();await expect(page.locator('.account-state')).toContainText(name);
> 71  |   await expect(page.getByRole('status').filter({hasText:'注册成功，已登录'})).toBeVisible();expect(navigations).toBe(0);expect(catalogRequests).toBe(0);
      |                                                                                                         ^ Error: expect(received).toBe(expected) // Object.is equality
  72  |   await expect(page.getByRole('button',{name:'立即同步',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
  73  |   const uploads:any[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/account/state'))uploads.push(r.postDataJSON());});
  74  |   await page.getByRole('button',{name:'微辣',exact:true}).click();
  75  |   await page.getByLabel('几个人吃',{exact:true}).fill('5');
  76  |   await page.getByLabel('手动添加食材',{exact:true}).fill('鸡蛋');await page.getByLabel('手动添加食材',{exact:true}).press('Enter');
  77  |   for(const [label,food] of [['过敏','花生'],['忌口','牛肉']]){
  78  |     await page.locator('.preference-shortcuts').getByRole('button',{name:new RegExp(label)}).click();
  79  |     await page.getByLabel(`${label}食物`,{exact:true}).fill(food);await page.getByRole('button',{name:'确认添加',exact:true}).click();await page.getByRole('button',{name:'完成',exact:true}).click();
  80  |   }
  81  |   await page.locator('.preference-shortcuts').getByRole('button',{name:/调料/}).click();await page.getByLabel('只使用家里现有的调料',{exact:true}).check();
  82  |   await page.getByLabel('食用盐',{exact:true}).uncheck();await page.getByRole('button',{name:'完成',exact:true}).click();
  83  |   await expect.poll(async()=>{const data=await(await page.request.get('/api/v1/account/state')).json();return data.value.defaults;}).toMatchObject({flavor:'微辣',checkSeasonings:true,restrictions:[{name:'花生'},{name:'牛肉'}]});
  84  |   await expect.poll(()=>uploads.length).toBeGreaterThan(0);
  85  |   for(const body of uploads){expect(Object.keys(body.value.defaults).sort()).toEqual(['checkSeasonings','flavor','restrictions','seasonings']);}
  86  |   await page.reload();await page.keyboard.press('Escape');await expect(page.getByLabel('几个人吃',{exact:true})).toHaveValue('5');await expect(page.getByRole('button',{name:'微辣',exact:true})).toHaveAttribute('aria-pressed','true');
  87  |   const second=await browser.newContext({baseURL:'http://127.0.0.1:4178'});try{
  88  |     const b=await second.newPage();await b.goto('/');await b.getByLabel('几个人吃',{exact:true}).fill('3');await b.getByRole('button',{name:'个人设置',exact:true}).click();
  89  |     await b.getByLabel('用户名',{exact:true}).fill(name);await b.getByLabel('密码',{exact:true}).fill('Ab1!xyZ9');await b.getByRole('button',{name:'登录并同步',exact:true}).click();await expect(b.locator('.account-state')).toContainText(name);await b.keyboard.press('Escape');
  90  |     await expect(b.getByLabel('几个人吃',{exact:true})).toHaveValue('3');await expect(b.getByRole('button',{name:'微辣',exact:true})).toHaveAttribute('aria-pressed','true');
  91  |     await expect(b.getByLabel('鸡蛋用量',{exact:true})).toHaveCount(0);
  92  |     await b.locator('.preference-shortcuts').getByRole('button',{name:/过敏/}).click();await expect(b.locator('.restrictions')).toContainText('花生');await b.keyboard.press('Escape');
  93  |     await b.locator('.preference-shortcuts').getByRole('button',{name:/忌口/}).click();await expect(b.locator('.restrictions')).toContainText('牛肉');await b.keyboard.press('Escape');
  94  |     await b.locator('.preference-shortcuts').getByRole('button',{name:/调料/}).click();await expect(b.getByLabel('只使用家里现有的调料',{exact:true})).toBeChecked();await expect(b.getByLabel('食用盐',{exact:true})).not.toBeChecked();
  95  |     await b.screenshot({path:info.outputPath('restored-personal-settings.png'),fullPage:true});
  96  |   }finally{await second.close();}
  97  | });
  98  | 
  99  | test('注册失败保留输入并聚焦原因；注册已受理但会话未确认时不能显示成功',async({page},info)=>{
  100 |   const password='Ab1!xyZ9',username=`partial-${info.project.name}`;
  101 |   await page.goto('/?settings=1');await page.getByRole('button',{name:'注册账号',exact:true}).click();
  102 |   await page.getByLabel('用户名',{exact:true}).fill('abc');
  103 |   await page.getByLabel('邮箱',{exact:true}).fill(`${username}@example.invalid`);
  104 |   await page.getByLabel('密码',{exact:true}).fill(password);await page.getByLabel('确认密码',{exact:true}).fill(password);
  105 |   await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  106 |   await expect(page.getByRole('alert')).toContainText('用户名须为5～24位');await expect(page.getByRole('alert')).toBeInViewport();await expect(page.getByRole('alert')).toBeFocused();
  107 |   await expect(page.getByLabel('密码',{exact:true})).toHaveValue(password);await expect(page.getByLabel('确认密码',{exact:true})).toHaveValue(password);
  108 |   await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByRole('button',{name:'获取验证码',exact:true}).click();
  109 |   await expect(page.locator('.account-form')).toContainText('验证码已发送');await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');
  110 |   await page.getByLabel('确认密码',{exact:true}).fill('Different!123');await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  111 |   await expect(page.getByRole('alert')).toHaveText('两次密码不一致');await expect(page.getByLabel('密码',{exact:true})).toHaveValue(password);await expect(page.getByLabel('确认密码',{exact:true})).toHaveValue('Different!123');
  112 |   await page.getByLabel('确认密码',{exact:true}).fill(password);
  113 |   await page.route('**/api/v1/auth/register',route=>route.fulfill({status:503,json:{error:{code:'ACCOUNT_UNAVAILABLE',message:'服务暂不可用，输入已保留'}}}),{times:1});
  114 |   await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  115 |   await expect(page.getByRole('alert')).toHaveText('服务暂不可用，输入已保留');await expect(page.getByRole('alert')).toBeFocused();await expect(page.getByRole('alert')).toBeInViewport();
  116 |   await expect(page.getByLabel('密码',{exact:true})).toHaveValue(password);await expect(page.getByLabel('确认密码',{exact:true})).toHaveValue(password);await expect(page.getByLabel('邮箱验证码',{exact:true})).toHaveValue('123456');
  117 |   expect(await page.evaluate(p=>JSON.stringify(localStorage).includes(p),password)).toBe(false);
  118 |   await page.route('**/api/v1/auth/session?state=1',route=>route.fulfill({json:{identity:'guest',accountAvailable:true,registrationAvailable:true,localTestFeatures:false,csrfToken:'simulated-cookie-block'}}),{times:1});
  119 |   await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  120 |   await expect(page.getByRole('alert')).toContainText('账号已创建，但未能确认登录状态');await expect(page.getByRole('alert')).toBeInViewport();await expect(page.locator('.account-state')).toHaveCount(0);
  121 |   await expect(page.getByLabel('密码',{exact:true})).toHaveValue(password);await expect(page.getByLabel('确认密码',{exact:true})).toHaveValue(password);
  122 |   await page.screenshot({path:info.outputPath('registration-session-unconfirmed.png'),fullPage:true});
  123 | });
  124 | 
```