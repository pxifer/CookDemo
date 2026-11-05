import {test,expect,type Page} from './local-browser';
import { defaultMeal } from '../shared/types';
import { addManualFood } from './ui-helpers';

test('忘记密码：通过受控邮箱验证码重置，旧密码失效，新密码可登录',async({page},info)=>{
  const name=`recovery-${info.project.name}`,email=`${name}@example.invalid`,oldPassword='Ab1!xyZ9',newPassword='New9!abcZ';
  await page.goto('/?settings=1');
  await page.getByRole('button',{name:'注册账号',exact:true}).click();
  await page.getByLabel('用户名',{exact:true}).fill(name);await page.getByLabel('邮箱',{exact:true}).fill(email);
  await page.getByRole('button',{name:'获取验证码',exact:true}).click();
  await expect(page.locator('.account-form')).toContainText('验证码已发送');
  await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');
  await page.getByLabel('密码',{exact:true}).fill(oldPassword);await page.getByLabel('确认密码',{exact:true}).fill(oldPassword);
  await page.getByRole('button',{name:'注册并登录',exact:true}).click();await expect(page.locator('.account-state')).toContainText(name);
  await page.getByRole('button',{name:'退出登录',exact:true}).click();
  await page.getByRole('button',{name:'忘记密码',exact:true}).click();
  await page.getByLabel('注册邮箱',{exact:true}).fill(email);await page.getByRole('button',{name:'获取找回验证码',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('若该邮箱可用于找回');
  await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');await page.getByLabel('新密码',{exact:true}).fill(newPassword);await page.getByLabel('确认新密码',{exact:true}).fill(newPassword);
  let resets=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/auth/recovery/complete'))resets++;});
  await page.route('**/api/v1/auth/recovery/complete',async route=>{await new Promise(resolve=>setTimeout(resolve,200));await route.continue();},{times:1});
  await page.locator('section[aria-label="找回密码"] form').evaluate((form:HTMLFormElement)=>{form.requestSubmit();form.requestSubmit();});
  await expect(page.getByRole('status')).toContainText('密码已重置');expect(resets).toBe(1);
  await page.getByRole('button',{name:'返回登录',exact:true}).click();
  await page.getByLabel('用户名',{exact:true}).fill(name);await page.getByLabel('密码',{exact:true}).fill(oldPassword);await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('用户名或密码不正确');
  await page.getByLabel('密码',{exact:true}).fill(newPassword);await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.locator('.account-state')).toContainText(name);
});

test('常规登录：只有一个登录按钮，未触发input事件的自动填充值可提交，失败不清空且防重复提交',async({page},info)=>{
  const name=`autofill-${info.project.name}`,password='Ab1!xyZ9';
  await page.goto('/?settings=1');
  await expect(page.getByRole('heading',{name:'登录',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'登录',exact:true})).toHaveCount(1);
  await expect(page.locator('.account-auth-tabs')).toHaveCount(0);
  await page.getByRole('button',{name:'注册账号',exact:true}).click();await expect(page.getByRole('heading',{name:'注册账号',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'返回登录',exact:true})).toBeVisible();
  await page.getByLabel('用户名',{exact:true}).fill(name);await page.getByLabel('邮箱',{exact:true}).fill(`${name}@example.invalid`);
  await page.getByRole('button',{name:'获取验证码',exact:true}).click();await expect(page.locator('.account-form')).toContainText('验证码已发送');
  await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');await page.getByLabel('密码',{exact:true}).fill(password);await page.getByLabel('确认密码',{exact:true}).fill(password);
  await page.getByRole('button',{name:'注册并登录',exact:true}).click();await expect(page.locator('.account-state')).toContainText(name);
  await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(page.getByRole('button',{name:'登录',exact:true})).toHaveCount(1);
  const fillWithoutEvents=async(value:string)=>page.evaluate(({name,value})=>{
    // Model password-manager DOM updates that do not notify React.
    const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
    set.call(document.querySelector('input[name="username"]'),name);set.call(document.querySelector('input[name="password"]'),value);
  },{name,value});
  await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('alert')).toContainText('请输入用户名');
  await fillWithoutEvents('Wrong!123');await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('用户名或密码不正确');await expect(page.getByLabel('密码',{exact:true})).toHaveValue('Wrong!123');await expect(page.getByLabel('用户名',{exact:true})).toHaveValue(name);
  await fillWithoutEvents(password);let posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/auth/login'))posts++;});
  await page.route('**/api/v1/auth/login',async route=>{await new Promise(resolve=>setTimeout(resolve,350));await route.continue();},{times:1});
  await page.evaluate(()=>{const form=document.querySelector<HTMLFormElement>('form.account-form')!;form.requestSubmit();form.requestSubmit();});
  await expect(page.getByRole('button',{name:'正在登录…',exact:true})).toBeDisabled();
  await expect(page.locator('.account-state')).toContainText(name);await expect(page.getByRole('status').filter({hasText:'登录成功。'})).toBeVisible();expect(posts).toBe(1);
  await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.screenshot({path:info.outputPath('conventional-login.png'),fullPage:true});
});
test('自助注册：无需邀请、错误码可重试、自动同步、刷新/换设备恢复与新账号隔离',async({page,browser},info)=>{
  const username=`signup-${info.project.name}`,password='Ab1!xyZ9';
  await page.goto('/?settings=1');
  const catalog=await(await page.request.get('/api/v1/catalog/recipes')).json(),recipe=catalog.recipes[0];
  await page.evaluate(({recipe,defaults})=>{
    localStorage.setItem('shiwei:guest:favorites:v1',JSON.stringify([{recipeId:recipe.id,variantId:recipe.variants[0].id}]));
    localStorage.setItem('shiwei:guest:defaults:v1',JSON.stringify(defaults));
  },{recipe,defaults:{...defaultMeal(),servings:2}});await page.reload();
  await page.getByRole('button',{name:'注册账号',exact:true}).click();
  await expect(page.locator('.account-form')).not.toContainText('受邀');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('registration-form.png'),fullPage:true});
  const signup=async(target:Page,name:string,wrongCode=false)=>{
    await target.getByLabel('用户名',{exact:true}).fill(name);await target.getByLabel('邮箱',{exact:true}).fill(`${name}@example.invalid`);
    if(wrongCode)await target.route('**/api/v1/auth/registration/code',route=>route.fulfill({status:400,json:{error:{code:'CAPTCHA_REQUIRED',message:'请先完成图片验证后重试'}}}),{times:1});
    await target.getByRole('button',{name:'获取验证码',exact:true}).click();
    if(wrongCode){await expect(target.getByAltText('图片验证码',{exact:true})).toBeVisible();await target.getByLabel('图片验证码',{exact:true}).fill('AB12');await target.getByRole('button',{name:'获取验证码',exact:true}).click();}
    await expect(target.locator('.account-form')).toContainText('验证码已发送');
    await expect(target.getByRole('button',{name:/秒后重发/})).toBeDisabled();
    const submit=async(code:string)=>{
      await target.getByLabel('邮箱验证码',{exact:true}).fill(code);await target.getByLabel('密码',{exact:true}).fill(password);await target.getByLabel('确认密码',{exact:true}).fill(password);
      await target.getByRole('button',{name:'注册并登录',exact:true}).click();
    };
    if(wrongCode){
      await submit('000000');
      const error=target.getByRole('alert').filter({hasText:'邮箱验证码不正确'});await expect(error).toBeInViewport();await expect(error).toBeFocused();
      await expect(target.getByLabel('密码',{exact:true})).toHaveValue(password);await expect(target.getByLabel('确认密码',{exact:true})).toHaveValue(password);
      await expect(target.getByLabel('邮箱验证码',{exact:true})).toHaveValue('000000');
      await target.screenshot({path:info.outputPath('registration-error-visible.png'),fullPage:true});
      // A retry needs only the corrected code; both password fields must survive.
      await target.getByLabel('邮箱验证码',{exact:true}).fill('123456');await target.getByRole('button',{name:'注册并登录',exact:true}).click();
    }else await submit('123456');
    await expect(target.locator('.account-state')).toContainText(name);
    await expect(target.getByRole('status').filter({hasText:'注册成功，已登录'})).toBeInViewport();
    await expect(target.getByText('首次登录请修改初始密码，再同步个人资料。',{exact:true})).toHaveCount(0);
  };
  await signup(page,username,true);
  await expect(page.locator('.sync-review')).toHaveCount(0);
  await page.reload();await expect(page.locator('.account-state')).toContainText(username);
  const saved=await(await page.request.get('/api/v1/account/state')).json();expect(saved.value.favorites).toHaveLength(1);expect(saved.value.defaults.servings).toBe(1);
  const second=await browser.newContext(),other=await browser.newContext();
  try{
    const secondPage=await second.newPage();await secondPage.goto('http://127.0.0.1:4178/?settings=1');
    await secondPage.route('**/api/v1/auth/login',route=>route.fulfill({status:400,json:{error:{code:'CAPTCHA_REQUIRED',message:'请先完成图片验证后重试'}}}),{times:1});
    await secondPage.getByLabel('用户名',{exact:true}).fill(username);await secondPage.getByLabel('密码',{exact:true}).fill(password);await secondPage.getByRole('button',{name:'登录',exact:true}).click();
    await expect(secondPage.getByAltText('图片验证码',{exact:true})).toBeVisible();await secondPage.getByLabel('图片验证码',{exact:true}).fill('AB12');await secondPage.getByLabel('密码',{exact:true}).fill(password);await secondPage.getByRole('button',{name:'登录',exact:true}).click();
    await expect(secondPage.locator('.account-state')).toContainText(username);
    await expect(secondPage.getByRole('status').filter({hasText:'登录成功。'})).toBeInViewport();
    const restored=await(await secondPage.request.get('/api/v1/account/state')).json();expect(restored.value).toEqual(saved.value);
    const otherPage=await other.newPage();await otherPage.goto('http://127.0.0.1:4178/?settings=1');await otherPage.getByRole('button',{name:'注册账号',exact:true}).click();await signup(otherPage,`${username}-b`);
    const separate=await(await otherPage.request.get('/api/v1/account/state')).json();expect(separate.value.favorites).toEqual([]);expect(separate.value.defaults.restrictions).toEqual([]);
    const firstSession=await(await secondPage.request.get('/api/v1/auth/session')).json(),otherSession=await(await otherPage.request.get('/api/v1/auth/session')).json();expect(firstSession.userId).not.toBe(otherSession.userId);
    await otherPage.getByRole('button',{name:'退出登录',exact:true}).click();await expect(otherPage.getByRole('button',{name:'登录',exact:true})).toBeVisible();
    expect((await otherPage.request.get('/api/v1/account/state')).status()).toBe(401);
  }finally{await second.close();await other.close();}
});

test('个人设置自动保存恢复：不重载页面，不同步人数或草稿，游客不能保存账户设置',async({page,browser},info)=>{
  await page.goto('/?settings=1');
  await expect(page.getByText('登录后自动恢复个人设置和收藏。',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'保存为常用偏好',exact:true})).toHaveCount(0);
  const name=`settings-${info.project.name}`;
  await page.getByRole('button',{name:'注册账号',exact:true}).click();
  await page.getByLabel('用户名',{exact:true}).fill(name);await page.getByLabel('邮箱',{exact:true}).fill(`${name}@example.invalid`);
  await page.getByRole('button',{name:'获取验证码',exact:true}).click();await expect(page.locator('.account-form')).toContainText('验证码已发送');
  await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');await page.getByLabel('密码',{exact:true}).fill('Ab1!xyZ9');await page.getByLabel('确认密码',{exact:true}).fill('Ab1!xyZ9');
  let navigations=0,catalogRequests=0;page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())navigations++;if(r.url().includes('/catalog/recipes'))catalogRequests++;});
  await page.getByRole('button',{name:'注册并登录',exact:true}).click();await expect(page.locator('.account-state')).toContainText(name);
  await expect(page.getByRole('status').filter({hasText:'注册成功，已登录'})).toBeVisible();expect(navigations).toBe(0);expect(catalogRequests).toBe(0);
  await expect(page.getByRole('button',{name:'立即同步',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
  const uploads:any[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/account/state'))uploads.push(r.postDataJSON());});
  await page.getByRole('button',{name:'微辣',exact:true}).click();
  await page.getByLabel('几个人吃',{exact:true}).fill('5');
  await addManualFood(page,'鸡蛋');
  for(const [label,food] of [['过敏','花生'],['忌口','牛肉']]){
    await page.locator('.preference-shortcuts').getByRole('button',{name:new RegExp(label)}).click();
    await page.getByLabel(`${label}食物`,{exact:true}).fill(food);await page.getByRole('button',{name:'确认添加',exact:true}).click();await page.getByRole('button',{name:'完成',exact:true}).click();
  }
  await page.locator('.preference-shortcuts').getByRole('button',{name:/调料/}).click();await page.getByLabel('只使用家里现有的调料',{exact:true}).check();
  await page.getByLabel('盐',{exact:true}).uncheck();await page.getByRole('button',{name:'完成',exact:true}).click();
  await expect.poll(async()=>{const data=await(await page.request.get('/api/v1/account/state')).json();return data.value.defaults;}).toMatchObject({flavor:'微辣',checkSeasonings:true,restrictions:[{name:'花生'},{name:'牛肉'}]});
  await expect.poll(()=>uploads.length).toBeGreaterThan(0);
  for(const body of uploads){expect(Object.keys(body.value.defaults).sort()).toEqual(['checkSeasonings','flavor','restrictions','seasonings']);}
  await page.reload();await page.keyboard.press('Escape');await expect(page.getByLabel('几个人吃',{exact:true})).toHaveValue('5');await expect(page.getByRole('button',{name:'微辣',exact:true})).toHaveAttribute('aria-pressed','true');
  const second=await browser.newContext({baseURL:'http://127.0.0.1:4178'});try{
    const b=await second.newPage();await b.goto('/');await b.getByLabel('几个人吃',{exact:true}).fill('3');await b.getByRole('button',{name:'个人设置',exact:true}).click();
    await b.getByLabel('用户名',{exact:true}).fill(name);await b.getByLabel('密码',{exact:true}).fill('Ab1!xyZ9');await b.getByRole('button',{name:'登录',exact:true}).click();await expect(b.locator('.account-state')).toContainText(name);await b.keyboard.press('Escape');
    await expect(b.getByLabel('几个人吃',{exact:true})).toHaveValue('3');await expect(b.getByRole('button',{name:'微辣',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(b.getByLabel('鸡蛋用量',{exact:true})).toHaveCount(0);
    await b.locator('.preference-shortcuts').getByRole('button',{name:/过敏/}).click();await expect(b.locator('.restrictions')).toContainText('花生');await b.keyboard.press('Escape');
    await b.locator('.preference-shortcuts').getByRole('button',{name:/忌口/}).click();await expect(b.locator('.restrictions')).toContainText('牛肉');await b.keyboard.press('Escape');
    await b.locator('.preference-shortcuts').getByRole('button',{name:/调料/}).click();await expect(b.getByLabel('只使用家里现有的调料',{exact:true})).toBeChecked();await expect(b.getByLabel('盐',{exact:true})).not.toBeChecked();
    await b.screenshot({path:info.outputPath('restored-personal-settings.png'),fullPage:true});
  }finally{await second.close();}
});

test('注册失败保留输入并聚焦原因；注册已受理但会话未确认时不能显示成功',async({page},info)=>{
  const password='Ab1!xyZ9',username=`partial-${info.project.name}`;
  await page.goto('/?settings=1');await page.getByRole('button',{name:'注册账号',exact:true}).click();
  await page.getByLabel('用户名',{exact:true}).fill('abc');
  await page.getByLabel('邮箱',{exact:true}).fill(`${username}@example.invalid`);
  await page.getByLabel('密码',{exact:true}).fill(password);await page.getByLabel('确认密码',{exact:true}).fill(password);
  await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('用户名须为5～24位');await expect(page.getByRole('alert')).toBeInViewport();await expect(page.getByRole('alert')).toBeFocused();
  await expect(page.getByLabel('密码',{exact:true})).toHaveValue(password);await expect(page.getByLabel('确认密码',{exact:true})).toHaveValue(password);
  await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByRole('button',{name:'获取验证码',exact:true}).click();
  await expect(page.locator('.account-form')).toContainText('验证码已发送');await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');
  await page.getByLabel('确认密码',{exact:true}).fill('Different!123');await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('两次密码不一致');await expect(page.getByLabel('密码',{exact:true})).toHaveValue(password);await expect(page.getByLabel('确认密码',{exact:true})).toHaveValue('Different!123');
  await page.getByLabel('确认密码',{exact:true}).fill(password);
  await page.route('**/api/v1/auth/register',route=>route.fulfill({status:503,json:{error:{code:'ACCOUNT_UNAVAILABLE',message:'服务暂不可用，输入已保留'}}}),{times:1});
  await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('服务暂不可用，输入已保留');await expect(page.getByRole('alert')).toBeFocused();await expect(page.getByRole('alert')).toBeInViewport();
  await expect(page.getByLabel('密码',{exact:true})).toHaveValue(password);await expect(page.getByLabel('确认密码',{exact:true})).toHaveValue(password);await expect(page.getByLabel('邮箱验证码',{exact:true})).toHaveValue('123456');
  expect(await page.evaluate(p=>JSON.stringify(localStorage).includes(p),password)).toBe(false);
  await page.route('**/api/v1/auth/session?state=1',route=>route.fulfill({json:{identity:'guest',accountAvailable:true,registrationAvailable:true,localTestFeatures:false,csrfToken:'simulated-cookie-block'}}),{times:1});
  await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('账号已创建，但未能确认登录状态');await expect(page.getByRole('alert')).toBeInViewport();await expect(page.locator('.account-state')).toHaveCount(0);
  await expect(page.getByLabel('密码',{exact:true})).toHaveValue(password);await expect(page.getByLabel('确认密码',{exact:true})).toHaveValue(password);
  await page.screenshot({path:info.outputPath('registration-session-unconfirmed.png'),fullPage:true});
});
