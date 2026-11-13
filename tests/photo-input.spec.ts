import {test,expect,type Page} from './local-browser';
async function testPhoto(page:Page){return Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;canvas.getContext('2d')!.fillRect(0,0,16,16);return canvas.toDataURL('image/png').split(',')[1];}),'base64');}
test('INPUT-001 图片确认后添加、不确定项不加入，普通推荐继续可用',async({page},info)=>{
  // Simulate only UI identity/capabilities. Real authentication and claims are covered by API tests.
  await page.route('**/api/v1/auth/session*',async route=>{const response=await route.fetch();const data=await response.json();await route.fulfill({response,json:{...data,userId:'offline-photo-ui',imageRecognitionProvider:'zhipu'}});});
  let calls=0;
  await page.route('**/api/v1/recognitions/image',async route=>{
    calls++;const body=route.request().postDataJSON();expect(body.image).toMatch(/^data:image\/jpeg;base64,/);expect(Object.keys(body).sort()).toEqual(['contentVersion','image','operationId']);
    await route.fulfill({json:{operationId:body.operationId,uncertain:['遮挡物'],extraction:{original:'图片识别',method:'model',ingredients:[{id:'egg-photo',foodId:'egg',name:'鸡蛋',amount:'',basis:'unknown',form:'raw',status:'pending',original:'鸡蛋'},{id:'tomato-photo',foodId:'tomato',name:'西红柿',amount:'',basis:'unknown',form:'raw',status:'pending',original:'西红柿'}],restrictions:[],diseases:[],servings:null,unresolved:[]}}});
  });
  await page.goto('/');await page.getByRole('button',{name:'拍照识别',exact:true}).click();
  await page.getByLabel('选择食材图片',{exact:true}).setInputFiles({name:'ingredients.png',mimeType:'image/png',buffer:await testPhoto(page)});
  expect(calls).toBe(0);await page.getByRole('button',{name:'识别食材',exact:true}).click();
  await expect(page.getByText('无法确定，未加入清单：遮挡物')).toBeVisible();expect(calls).toBe(1);
  await expect(page.locator('.ingredients .ingredient-name')).toHaveCount(0);
  await page.getByRole('checkbox',{name:'西红柿',exact:true}).uncheck();await page.getByRole('button',{name:'添加所选食材',exact:true}).click();
  await expect(page.locator('.ingredients .ingredient-name')).toHaveText(['鸡蛋']);
  await expect(page.getByRole('button',{name:'选择图片',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'手机拍照',exact:true})).toBeVisible();
  await expect(page.getByLabel('鸡蛋用量',{exact:true})).toHaveCount(0);await expect(page.locator('.amount-hint')).toHaveCount(0);
  await page.getByLabel('允许补买食材',{exact:false}).check();await page.getByRole('button',{name:'安排这一餐',exact:true}).click();await expect(page.getByTestId('recipe-card').first()).toBeVisible();
  expect(calls).toBe(1);await page.screenshot({path:`${process.env.ACCEPTANCE_DIR??'artifacts/acceptance'}/${info.project.name}-photo-input.png`,fullPage:true});
});
test('INPUT-001 识别迟到时移除图片，结果不能重新加入界面',async({page})=>{
  await page.route('**/api/v1/auth/session*',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),userId:'offline-photo-ui',imageRecognitionProvider:'zhipu'}});});
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/v1/recognitions/image',async route=>{await gate;await route.fulfill({status:502,json:{error:{message:'构造失败'}}}).catch(()=>{});});
  await page.goto('/');await page.getByRole('button',{name:'拍照识别',exact:true}).click();await page.getByLabel('选择食材图片',{exact:true}).setInputFiles({name:'test.png',mimeType:'image/png',buffer:await testPhoto(page)});
  const sent=page.waitForRequest('**/api/v1/recognitions/image');await page.getByRole('button',{name:'识别食材',exact:true}).click();await sent;
  await page.getByRole('button',{name:'移除图片',exact:true}).click();release();await expect(page.locator('.photo-preview')).toHaveCount(0);await expect(page.locator('.photo-candidates')).toHaveCount(0);
});

test('INPUT-002 含糊食材可直接点选具体名称，无需手动改字',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'文字输入',exact:true}).click();await page.getByLabel('输入食材与本餐信息',{exact:true}).fill('生肉');await page.getByRole('button',{name:'整理信息 ↗',exact:true}).click();
 await page.getByLabel('匹配 生肉',{exact:true}).getByRole('button',{name:'牛肉',exact:true}).click();
 await expect(page.locator('.ingredients .ingredient-name')).toHaveText(['牛肉']);await expect(page.getByLabel('更正未识别名称 生肉',{exact:true})).toHaveCount(0);
});
