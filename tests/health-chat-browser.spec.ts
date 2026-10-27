import {test,expect,type Page} from '@playwright/test';
const key='sk-browser-test-only-health-123456789';
const evidence=process.env.HEALTH_CHAT_ACCEPTANCE_DIR??'acceptance/health-account-2026-10-27';
async function enter(page:Page,name:string){
  await page.goto('/');await page.getByRole('button',{name:/健康模式/}).click();await expect(page.getByRole('dialog')).not.toContainText('健康模式');
  await page.getByRole('button',{name:'注册账号',exact:true}).click();const username=`save-${name}-${Date.now().toString().slice(-5)}`;
  await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('邮箱',{exact:true}).fill(`${username}@example.invalid`);await page.getByRole('button',{name:'获取验证码',exact:true}).click();await expect(page.locator('.account-form')).toContainText('验证码已发送');
  await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');await page.getByLabel('密码',{exact:true}).fill('Chat!Test123');await page.getByLabel('确认密码',{exact:true}).fill('Chat!Test123');await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  await expect(page.getByLabel('DeepSeek API Key',{exact:true})).toBeVisible();await page.getByLabel('DeepSeek API Key',{exact:true}).fill(key);await page.getByRole('button',{name:'保存 Key',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Key 已保存');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:/健康模式/}).click();await expect(page.getByRole('region',{name:'健康AI对话',exact:true})).toBeVisible();return username;
}
async function send(page:Page,text:string){const chat=page.getByRole('region',{name:'健康AI对话',exact:true});await page.getByLabel('给AI的消息',{exact:true}).fill(text);await chat.getByRole('button',{name:'发送消息',exact:true}).click();return chat;}

test('Key随账户恢复、无健康弹框、不入浏览器存储，清空可停用',async({page},info)=>{
  let calls=0;page.on('request',req=>{if(req.method()==='POST'&&req.url().endsWith('/api/v1/health/chat'))calls++;});const username=await enter(page,info.project.name);
  const chat=page.getByRole('region',{name:'健康AI对话',exact:true});await chat.screenshot({path:`${evidence}/${info.project.name}-welcome.png`});expect(calls).toBe(0);
  await page.reload();await expect(chat).toBeVisible();await expect(chat.getByRole('button',{name:'发送消息',exact:true})).toBeDisabled();
  expect(await page.evaluate(secret=>[...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>value.includes(secret)),key)).toBe(false);
  await page.getByRole('button',{name:'个人设置',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('DeepSeek Key 已保存');await expect(page.getByLabel('DeepSeek API Key',{exact:true})).toHaveValue('');await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(chat).toHaveCount(0);
  await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill('Chat!Test123');await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('DeepSeek Key 已保存');
  await page.getByRole('dialog').screenshot({path:`${evidence}/${info.project.name}-settings.png`});await page.getByRole('button',{name:'清空 Key',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('尚未配置');expect(calls).toBe(0);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:/健康模式/}).click();await expect(page.getByRole('dialog')).toHaveAttribute('aria-labelledby','modal-title');await expect(page.getByRole('dialog').getByRole('heading',{name:'个人设置',exact:true})).toBeVisible();await expect(chat).toHaveCount(0);
});

test('健康目标和推荐/不推荐自动保存恢复；既有过敏忌口不重复；本餐筛选保持输入',async({page},info)=>{
  await enter(page,`guide-${info.project.name}`);
  await page.getByRole('button',{name:/^过敏/}).click();await page.getByLabel('过敏食物',{exact:true}).fill('花生');await page.getByRole('button',{name:'确认添加',exact:true}).click();const confirm=page.getByRole('button',{name:'确认避开这些食物',exact:true});if(await confirm.count())await confirm.first().click();await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByRole('button',{name:/^忌口/}).click();await page.getByLabel('忌口食物',{exact:true}).fill('猪肉');await page.getByRole('button',{name:'确认添加',exact:true}).click();if(await confirm.count())await confirm.first().click();await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByRole('button',{name:'文字输入',exact:true}).click();await page.getByLabel('输入食材与本餐信息',{exact:true}).fill('西红柿300g鸡蛋3个');await page.getByRole('button',{name:'整理信息 ↗',exact:true}).click();await expect(page.getByRole('list',{name:'我的食材',exact:true})).toContainText('西红柿');await page.getByRole('checkbox',{name:/允许补买食材/}).check();
  let sent:any;page.on('request',req=>{if(req.url().endsWith('/api/v1/health/chat'))sent=req.postDataJSON();});const chat=await send(page,'应用建议：我想增肌，没有已知疾病');
  const guidance=chat.getByRole('region',{name:'AI食材建议',exact:true});await expect(guidance).toBeVisible();expect(sent.apiKey).toBeUndefined();await expect(guidance).not.toContainText('花生');await expect(guidance).not.toContainText('猪肉');await expect(chat.getByRole('log')).not.toContainText('花生');await expect(guidance).toContainText('西红柿');
  const snapshot=await page.evaluate(async()=>await(await fetch('/api/v1/account/state')).json());expect(snapshot.value.defaults.healthProfile.goals).toEqual(['增肌']);expect(snapshot.value.defaults.healthProfile.suggestions.map((item:any)=>item.foodName)).toEqual(['西红柿','火星草']);
  await chat.screenshot({path:`${evidence}/${info.project.name}-guidance.png`});
  const request=page.waitForRequest(req=>req.url().endsWith('/api/v1/recommendations')&&req.method()==='POST');await guidance.getByRole('button',{name:'结合现有食材搭配这一餐',exact:true}).click();const meal=(await request).postDataJSON().meal;expect(meal.allowBuy).toBe(true);expect(meal.ingredients.map((item:any)=>item.name)).toEqual(['西红柿','鸡蛋']);expect(meal.restrictions).toHaveLength(2);
  await page.reload();await expect(guidance).toBeVisible();await expect(guidance).not.toContainText('花生');await expect(chat.locator('.health-profile-summary')).toContainText('增肌');
  await page.getByRole('button',{name:'个人设置',exact:true}).click();await expect(page.getByRole('region',{name:'健康档案',exact:true})).toContainText('增肌');const saved=page.waitForResponse(res=>res.url().endsWith('/api/v1/account/state')&&res.request().method()==='POST'&&res.ok());await page.getByRole('button',{name:'清除健康档案与AI建议',exact:true}).click();await saved;await page.keyboard.press('Escape');await expect(guidance).toHaveCount(0);
});

test('多轮、取消和Key错误保留输入；桌面手机不横向溢出',async({page},info)=>{
  await enter(page,`chat-${info.project.name}`);const chat=await send(page,'先了解一下蒸和煎');await expect(chat.getByRole('log')).toContainText('已收到 1 条对话消息');await send(page,'继续解释');await expect(chat.getByRole('log')).toContainText('已收到 3 条对话消息');
  await send(page,'测试慢回复');await expect(chat.getByRole('button',{name:'取消回复',exact:true})).toBeVisible();await chat.getByRole('button',{name:'取消回复',exact:true}).click();await expect(page.getByLabel('给AI的消息',{exact:true})).toHaveValue('测试慢回复');
  await chat.getByRole('button',{name:'模型设置',exact:true}).click();await page.getByLabel('DeepSeek API Key',{exact:true}).fill('sk-rejected-test-only-123456789');await page.getByRole('button',{name:'更换 Key',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Key 已保存');await page.keyboard.press('Escape');await send(page,'测试问题');await expect(chat.getByRole('alert')).toContainText('Key 无效');await expect(page.getByLabel('给AI的消息',{exact:true})).toHaveValue('测试问题');
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});


test('三栏分别接受并保存、页内查看做法、提示自动消失，搭配后定位菜品',async({page},info)=>{
  await enter(page,`pick-${info.project.name}`);
  const toast=page.getByText('健康模式已开启，可以和 AI 对话了',{exact:true});await expect(toast).toBeVisible();await expect(toast).toHaveCount(0,{timeout:3000});
  await page.getByRole('button',{name:'文字输入',exact:true}).click();await page.getByLabel('输入食材与本餐信息',{exact:true}).fill('西红柿300g鸡蛋3个');await page.getByRole('button',{name:'整理信息 ↗',exact:true}).click();await expect(page.getByRole('list',{name:'我的食材',exact:true})).toContainText('西红柿');await page.getByRole('checkbox',{name:/允许补买食材/}).check();
  const chat=await send(page,'应用建议：请给三类食材选择');const guidance=chat.getByRole('region',{name:'AI食材建议',exact:true});await expect(guidance).toBeVisible();
  expect((await page.evaluate(async()=>await(await fetch('/api/v1/account/state')).json())).value.defaults.aiFoodPreferences).toBeUndefined();
  for(const name of ['接受推荐','接受少选','接受避开'])await guidance.getByRole('button',{name,exact:true}).click();
  await expect(guidance.getByRole('button',{name:'已接受',exact:true})).toHaveCount(3);
  await expect.poll(async()=>{const data=await page.evaluate(async()=>await(await fetch('/api/v1/account/state')).json());return data.value.defaults.aiFoodPreferences;}).toEqual({preferred:['西红柿'],limited:['猪肉'],excluded:['花生','火星草']});
  await expect(guidance.locator('a')).toHaveCount(0);const example=guidance.getByRole('region',{name:'AI搭配食谱',exact:true}).getByRole('button').first();await example.click();await expect(page.getByRole('dialog').locator('.steps li').first()).toBeVisible();expect(new URL(page.url()).pathname).toBe('/');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'个人设置',exact:true}).click();const saved=page.getByRole('region',{name:'已接受的AI食材选择',exact:true});await expect(saved).toContainText('西红柿');await expect(saved).toContainText('猪肉');await expect(saved).toContainText('花生');await expect(saved).toContainText('火星草（待匹配）');await saved.scrollIntoViewIfNeeded();await page.getByRole('dialog').screenshot({path:`${evidence}/${info.project.name}-accepted-settings.png`});await page.keyboard.press('Escape');
  await page.reload();await expect(guidance.getByRole('button',{name:'已接受',exact:true})).toHaveCount(3);await chat.screenshot({path:`${evidence}/${info.project.name}-accepted-guidance.png`});
  await guidance.getByRole('button',{name:'结合现有食材搭配这一餐',exact:true}).click();await expect(chat.getByRole('button',{name:'展开对话',exact:true})).toBeVisible();
  const grid=page.getByRole('region',{name:'推荐菜谱',exact:true}).or(page.locator('.recipe-grid'));await expect(page.getByTestId('recipe-card').first()).toBeVisible();await expect.poll(()=>grid.evaluate(element=>{const top=element.getBoundingClientRect().top+scrollY;const reachable=Math.min(Math.max(0,top-16),document.documentElement.scrollHeight-innerHeight);return Math.abs(scrollY-reachable);})).toBeLessThan(3);await expect(page.getByTestId('recipe-card').first()).toBeInViewport({ratio:0.8});
  await page.screenshot({path:`${evidence}/${info.project.name}-positioned-results.png`});
});
