import {test,expect,type Page} from '@playwright/test';
const key='sk-browser-test-only-health-123456789';
const evidence=process.env.HEALTH_CHAT_ACCEPTANCE_DIR??'acceptance/health-chat-2026-10-27';
async function enter(page:Page,project:string){
  await page.goto('/');await page.getByRole('button',{name:/健康模式/}).click();
  await expect(page.getByRole('dialog')).not.toContainText('健康推荐暂不可用');
  await expect(page.getByLabel('DeepSeek API Key',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'登录并设置健康模式',exact:true}).click();
  await page.getByRole('button',{name:'注册账号',exact:true}).click();
  const username=`health-${project}-${Date.now().toString().slice(-5)}`;
  await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('邮箱',{exact:true}).fill(`${username}@example.invalid`);
  await page.getByRole('button',{name:'获取验证码',exact:true}).click();await expect(page.locator('.account-form')).toContainText('验证码已发送');
  await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');await page.getByLabel('密码',{exact:true}).fill('Chat!Test123');await page.getByLabel('确认密码',{exact:true}).fill('Chat!Test123');
  await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  await expect(page.getByLabel('DeepSeek API Key',{exact:true})).toBeVisible();
  await page.getByLabel('DeepSeek API Key',{exact:true}).fill(key);
  await page.getByRole('button',{name:'开启健康模式',exact:true}).click();
  await expect(page.getByRole('region',{name:'健康AI对话',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'健康AI对话',exact:true})).toBeInViewport({ratio:0.5});
}
test('健康模式：真实登录回跳、个人Key、多轮对话、取消、页面内存隔离及退出清理',async({page},info)=>{
  await enter(page,info.project.name);
  const chat=page.getByRole('region',{name:'健康AI对话',exact:true}),input=page.getByLabel('给AI的消息',{exact:true});
  await expect(chat.getByRole('button',{name:'发送消息',exact:true})).toBeDisabled();
  await input.fill('蒸和煎有什么区别？');await chat.getByRole('button',{name:'发送消息',exact:true}).click();
  await expect(chat.getByRole('log')).toContainText('已收到 1 条对话消息');
  await input.fill('继续解释食材成分');await input.press('Enter');
  await expect(chat.getByRole('log')).toContainText('已收到 3 条对话消息');
  expect(await page.evaluate(secret=>[...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>value.includes(secret)),key)).toBe(false);
  await expect(page.locator('body')).not.toContainText(key);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize(info.project.name==='mobile'?{width:390,height:844}:{width:1440,height:1000});
  await chat.screenshot({path:`${evidence}/${info.project.name}-chat.png`});
  await input.fill('测试慢回复');await chat.getByRole('button',{name:'发送消息',exact:true}).click();
  await expect(chat.getByText('AI 正在思考…',{exact:true})).toBeVisible();await chat.getByRole('button',{name:'取消回复',exact:true}).click();
  await expect(input).toBeEnabled();await expect(input).toHaveValue('测试慢回复');await expect(chat.getByText('AI 正在思考…',{exact:true})).toHaveCount(0);
  await chat.getByRole('button',{name:'清空对话',exact:true}).click();await expect(chat.getByRole('log')).not.toContainText('构造AI回复');
  await page.reload();await expect(chat).toBeVisible();await expect(chat.getByRole('button',{name:'发送消息',exact:true})).toBeDisabled();
  await chat.getByRole('button',{name:'填写 API Key',exact:true}).click();await expect(page.getByLabel('DeepSeek API Key',{exact:true})).toHaveValue('');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'个人设置',exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click();
  await expect(chat).toHaveCount(0);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/健康模式/}).click();await expect(page.getByLabel('DeepSeek API Key',{exact:true})).toHaveCount(0);
});
test('Key错误可更换，失败保留问题；关闭模式后清理Key和对话',async({page},info)=>{
  await enter(page,`err-${info.project.name}`);
  const chat=page.getByRole('region',{name:'健康AI对话',exact:true});
  await chat.getByRole('button',{name:'更换 API Key',exact:true}).click();await page.getByLabel('DeepSeek API Key',{exact:true}).fill('sk-rejected-test-only-123456789');await page.getByRole('button',{name:'完成设置',exact:true}).click();
  const input=page.getByLabel('给AI的消息',{exact:true});await input.fill('测试问题');await chat.getByRole('button',{name:'发送消息',exact:true}).click();
  await expect(chat.getByRole('alert')).toContainText('API Key 无效');await expect(input).toHaveValue('测试问题');
  await chat.getByRole('button',{name:'更换 API Key',exact:true}).click();await page.getByLabel('DeepSeek API Key',{exact:true}).fill(key);await page.getByRole('button',{name:'完成设置',exact:true}).click();
  await input.fill('换Key后的问题');await chat.getByRole('button',{name:'发送消息',exact:true}).click();await expect(chat.getByRole('log')).toContainText('构造AI回复');
  await page.getByRole('button',{name:'切回普通模式',exact:true}).click();await expect(chat).toHaveCount(0);
  await page.getByRole('button',{name:/健康模式/}).click();await expect(page.getByLabel('DeepSeek API Key',{exact:true})).toHaveValue('');
});

test('先确认建议再加入AI去疾，保留食材/补买/过敏忌口，关闭健康后排除暂停',async({page},info)=>{
  await enter(page,`ai-${info.project.name}`);
  const chat=page.getByRole('region',{name:'健康AI对话',exact:true});
  const raw=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.includes('meal')))));
  await page.getByLabel('给AI的消息',{exact:true}).fill('应用建议：已有测试疾病，先看看食材建议');await chat.getByRole('button',{name:'发送消息',exact:true}).click();
  const suggestions=chat.getByRole('region',{name:'确认AI食材建议',exact:true});await expect(suggestions).toBeVisible();
  await expect(chat.getByRole('log')).not.toContainText('**');await expect(chat.locator('.chat-rich-text ol')).toBeVisible();await expect(chat.locator('.chat-rich-text strong').filter({hasText:'西红柿'})).toBeVisible();
  const list=chat.getByRole('complementary',{name:'AI去疾',exact:true});await expect(list).toContainText('尚未添加');
  await expect(chat.getByText('目录暂不能匹配此项，保留参考。',{exact:true})).toBeVisible();
  await chat.locator('.chat-call-receipt summary').click();await expect(chat.locator('.chat-call-receipt')).toContainText('mock-deepseek-');await expect(chat.locator('.chat-call-receipt')).toContainText('100 / 80 tokens');
  expect(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.includes('meal')))))).toBe(raw);
  await suggestions.getByRole('button',{name:'同意选择，暂不搭配',exact:true}).click();
  await expect(list.getByRole('button',{name:'取消AI去疾排除 花生',exact:true})).toBeVisible();await expect(list).toContainText('西红柿');
  const saved=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.includes('meal')).map(([,value])=>JSON.parse(value)).find(value=>value.aiFoodChoices));
  expect(saved.aiFoodChoices.excluded).toEqual(['花生']);expect(saved.restrictions).toEqual([]);expect(saved.ingredients).toEqual([]);expect(saved.allowBuy).toBe(false);
  await chat.screenshot({path:`${evidence}/${info.project.name}-ai-food-guidance.png`});
  await page.getByRole('button',{name:'切回普通模式',exact:true}).click();await expect(page.getByRole('complementary',{name:'AI去疾',exact:true})).toHaveCount(0);
});
