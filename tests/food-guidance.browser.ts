import {test,expect} from './local-browser';
const evidence=process.env.HEALTH_CHAT_ACCEPTANCE_DIR??'artifacts/acceptance/business-rag-2026-11-04/research-browser';
test('研究RAG：明确条件→有来源建议→实际菜品依据，桌面与手机衔接',async({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:/健康模式/}).click();
  await page.getByRole('button',{name:'注册账号',exact:true}).click();const username=`rag-${info.project.name}-${Date.now().toString().slice(-5)}`;
  await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('邮箱',{exact:true}).fill(`${username}@example.invalid`);await page.getByRole('button',{name:'获取验证码',exact:true}).click();await expect(page.locator('.account-form')).toContainText('验证码已发送');
  await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');await page.getByLabel('密码',{exact:true}).fill('Chat!Test123');await page.getByLabel('确认密码',{exact:true}).fill('Chat!Test123');await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  await expect(page.getByLabel('DeepSeek API Key',{exact:true})).toBeVisible();await page.getByLabel('DeepSeek API Key',{exact:true}).fill('sk-research-browser-fixture-123456789');await page.getByRole('button',{name:'保存 Key',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Key 已保存');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/健康模式/}).click();const chat=page.getByRole('region',{name:'健康AI对话',exact:true});await expect(chat).toBeVisible();
  await page.getByRole('button',{name:'文字输入',exact:true}).click();await page.getByLabel('输入食材与本餐信息',{exact:true}).fill('西红柿600g鸡蛋5个');await page.getByRole('button',{name:'整理信息 ↗',exact:true}).click();await expect(page.getByRole('list',{name:'我的食材',exact:true})).toContainText('鸡蛋');await page.getByRole('checkbox',{name:/允许补买食材/}).check();
  const replyPromise=page.waitForResponse(r=>r.url().endsWith('/api/v1/health/chat')&&r.request().method()==='POST');await page.getByLabel('给AI的消息',{exact:true}).fill('我是成年人，我身体健康，我规律抗阻训练，我想增肌');await chat.getByRole('button',{name:'发送消息',exact:true}).click();
  const reply=await(await replyPromise).json();expect(reply.knowledge).toBe('research_rag');expect(reply.invocation).toBeUndefined();expect(reply.researchGuidance.evidence.some((e:any)=>e.id==='goal-ev:exercise-egg')).toBe(true);
  const guidance=chat.getByRole('region',{name:'AI食材建议',exact:true});await expect(guidance).toContainText('鸡蛋');await expect(guidance).toContainText('蛋白来源候选');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/recommendations')&&r.request().method()==='POST');await guidance.getByRole('button',{name:'请 AI 结合现有食材搭配',exact:true}).click();
  const body=await(await response).text();const result=body.trim().split('\n').map(line=>JSON.parse(line)).find(event=>event.type==='result')?.result;
  expect(result?.status).toBe('completed');expect(result.researchGuidance.mode).toBe('local_research');expect(result.dishes.some((dish:any)=>dish.aiGrounding.matches.length)).toBe(true);
  await expect(page.locator('.ai-meal-summary')).toContainText('有来源');await expect(page.locator('.ai-recipe-reason').filter({hasText:'增肌'}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`${evidence}/${info.project.name}-business-rag.png`});
});
