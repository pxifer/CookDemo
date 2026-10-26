# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: registration-browser.spec.ts >> 自助注册：无需邀请、错误码可重试、自动同步、刷新/换设备恢复与新账号隔离
- Location: tests\registration-browser.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: '登录并同步', exact: true })
Expected: visible
Timeout: 7000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: '登录并同步', exact: true }) with timeout 7000ms
  - waiting for getByRole('button', { name: '登录并同步', exact: true })

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
    - link "我的收藏 0":
      - /url: /favorites
  - button "个人设置": 我
- main:
  - text: A LITTLE INSPIRATION, EVERY DAY
  - heading "今天，吃点什么？" [level=1]
  - paragraph: 打开冰箱，把手边的食材变成一顿好饭。
  - button "健康模式 了解健康推荐":
    - strong: 健康模式
    - text: 了解健康推荐
  - text: 少一点纠结，多一点烟火气
  - heading "有啥，做啥。 好好吃一餐。" [level=2]
  - paragraph: 食材不浪费，搭配刚刚好。
  - img "番茄炒蛋、时蔬和汤的家常餐食示意": 家常滋味 · 图片为示意
  - heading "01 看看有什么食材" [level=2]
  - text: 0 种
  - group "输入方式":
    - button "拍照 / 上传" [pressed]
    - button "文字输入"
  - strong: 拍下食材，灵感就来了
  - text: 图片识别暂不可用，请使用文字或手动添加
  - button "选择图片"
  - button "手机拍照"
  - paragraph: 图片仅在本页预览；识别暂不可用，请用文字或手动添加食材。手机拍照由设备支持情况决定。
  - button "转到文字录入 →"
  - strong: 我的食材
  - text: 用量选填
  - paragraph: 填写用量，搭配菜数和补买建议会更精确。
  - text: 添加现有食材，或允许补买查看默认推荐
  - list "我的食材"
  - combobox "手动添加食材"
  - button "＋ 添加" [disabled]
  - heading "02 这一餐的偏好" [level=2]
  - button "个人设置 ↗"
  - text: 几个人吃
  - button "1 人配菜参考 · 查看人数表": 配菜参考 ↗
  - button "减少人数": −
  - spinbutton "几个人吃": "1"
  - button "增加人数": ＋
  - group "今天的口味":
    - text: 今天的口味
    - button "不限" [pressed]
    - button "清淡"
    - button "微辣"
    - combobox "更多口味":
      - option "更多" [selected]
  - button "过敏 未设置"
  - button "忌口 未设置"
  - button "调料 不限库存"
  - checkbox "允许补买食材 只用现有食材，直接搭配一餐"
  - text: 允许补买食材 只用现有食材，直接搭配一餐
  - button "安排这一餐": 搭配这一餐 ✧
  - region "本餐推荐":
    - text: MADE FOR YOUR TABLE
    - heading "这一餐，安排好了" [level=2]
    - text: 从手边食材开始
    - strong: 一键搭配
    - text: 按人数、食材种类和用量灵活搭配
    - button "开始新一餐 ↻"
    - button "荤素汤搭配 ⌄"
    - heading "好好吃饭，从手边开始" [level=3]
    - paragraph: 添加手边食材，选好口味， 让我们把这一餐搭配好。
    - text: 1 添加食材 2 搭配一餐 3 照着做就好
- contentinfo: 拾味 把日子，过得有滋有味。 好好吃饭，好好生活。
- dialog "个人设置":
  - heading "个人设置" [level=2]
  - button "关闭弹层": ×
  - paragraph: 登录后可保存个人设置。
  - heading "账号" [level=3]
  - button "登录"
  - button "注册账号" [pressed]
  - paragraph: 创建账号，保存个人设置和收藏。
  - text: 用户名
  - textbox "用户名": signup-desktop-b
  - text: 邮箱
  - textbox "邮箱": signup-desktop-b@example.invalid
  - paragraph: 邮箱用于验证账号归属。无需邀请码。
  - text: 邮箱验证码
  - textbox "邮箱验证码": "123456"
  - button "54秒后重发" [disabled]
  - text: 密码
  - textbox "密码"
  - text: 确认密码
  - textbox "确认密码"
  - paragraph: 密码8～32位，包含大小写字母、数字和符号。
  - button "注册并登录"
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
> 55  |     await otherPage.getByRole('button',{name:'退出登录',exact:true}).click();await expect(otherPage.getByRole('button',{name:'登录并同步',exact:true})).toBeVisible();
      |                                                                                                                                                ^ Error: expect(locator).toBeVisible() failed
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
  71  |   await expect(page.getByRole('status').filter({hasText:'注册成功，已登录'})).toBeVisible();expect(navigations).toBe(0);expect(catalogRequests).toBe(0);
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