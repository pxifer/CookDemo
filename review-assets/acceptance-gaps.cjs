// Review evidence only: closes selected acceptance coverage gaps on the deployed demo.
const {chromium} = require('C:/Users/彭霄/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const onlyUncertain = process.argv.includes('--only-uncertain');
const evidencePath = path.join(__dirname,'acceptance-gaps-evidence.json');
const report = onlyUncertain ? JSON.parse(fs.readFileSync(evidencePath,'utf8')) : {target:'https://cookdemo.pages.dev/',started:new Date().toISOString(),checks:[],errors:[]};
if (onlyUncertain) { report.checks=report.checks.filter(c=>c.id!=='UNCERTAIN_ALLERGEN_CANDIDATES'); report.reruns=[...(report.reruns||[]),{id:'UNCERTAIN_ALLERGEN_CANDIDATES',started:new Date().toISOString(),reason:'Corrected harness to use the visible browse purchase checkbox.'}]; }
let browser;
const save = () => fs.writeFileSync(path.join(__dirname,'acceptance-gaps-evidence.json'),JSON.stringify(report,null,2));
(async () => {
  browser = await chromium.launch({channel:'msedge',headless:true});
  for (const mobile of [false,true]) {
    const ctx = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,locale:'zh-CN'});
    const p = await ctx.newPage();
    p.setDefaultTimeout(9000);
    p.setDefaultNavigationTimeout(45000);
    p.on('pageerror',e=>report.errors.push({mobile,message:e.message}));
    const b = name => p.getByRole('button',{name,exact:true});
    const ready = () => p.waitForFunction(()=>!document.getElementById('generate-button').disabled);
    const check = async (id,fn) => {if(onlyUncertain&&id!=='UNCERTAIN_ALLERGEN_CANDIDATES')return;try {report.checks.push({id,mobile,status:'executed',facts:await fn()});console.log('DONE '+id+' '+mobile);} catch(e) {report.checks.push({id,mobile,status:'test_error',error:e.message});console.log('ERROR '+id+' '+mobile);} save();};
    const generate = async () => {await p.locator('#generate-button').click();await ready();};
    const state = async () => ({ingredients:await p.locator('#ingredient-list input').evaluateAll(es=>es.map(e=>e.value)),servings:await p.locator('#servings').inputValue(),allergies:await p.locator('#quick-allergies').inputValue(),others:await p.locator('#include-others').isChecked(),seasoningMode:await p.locator('[name="seasoning-mode"]:checked').inputValue(),seasonings:await p.locator('[data-seasoning]:checked').evaluateAll(es=>es.map(e=>e.dataset.seasoning)),flavor:await p.locator('#input-flavors .active').innerText()});
    await p.goto(report.target,{waitUntil:'domcontentloaded'});
    await check('PROFILE_SEASONINGS_FLAVOR_RELOAD',async()=>{
      await b('个人设置').click();
      await p.locator('#profile-allergies').fill('虾');
      await p.locator('#profile-others').fill('花生');
      await p.locator('#profile-flavor').selectOption('清淡');
      for (const c of await p.locator('[data-profile-seasoning]').all()) await c.uncheck();
      for (const s of ['食用油','盐','生抽']) await p.locator('[data-profile-seasoning="'+s+'"]').check();
      await b('保存设置').click();
      await p.locator('.secondary-settings summary').click();
      await p.locator('[name="seasoning-mode"][value="check"]').check();
      await p.reload({waitUntil:'domcontentloaded'});
      await p.locator('.secondary-settings summary').click();
      const restored = await state();
      await b('个人设置').click();
      const profile = {allergies:await p.locator('#profile-allergies').inputValue(),others:await p.locator('#profile-others').inputValue(),flavor:await p.locator('#profile-flavor').inputValue(),seasonings:await p.locator('[data-profile-seasoning]:checked').evaluateAll(es=>es.map(e=>e.dataset.profileSeasoning))};
      await p.keyboard.press('Escape');return {restored,profile};
    });
    await check('HEALTH_NONDEFAULT_STATE_PRESERVED',async()=>{
      await b('✧ 没想好？用示例食材试一试 →').click();
      await p.locator('#servings').fill('2');await p.locator('#servings').blur();
      await p.locator('#include-others').check();
      const before=await state();
      await p.locator('#health-entry').click();await b('使用演示账户继续 →').click();
      await b('高血压').click();await b('确认名称并开启').click();await ready();
      const healthy=await state();
      await p.locator('#health-entry').click();await b('使用普通模式').click();await ready();
      const ordinary=await state();
      await p.reload({waitUntil:'domcontentloaded'});await b('个人设置').click();
      const savedHealth=await p.locator('#modal').innerText();await p.keyboard.press('Escape');
      return {before,healthy,ordinary,savedHealth};
    });
    await check('PARTIAL_RECOGNITION_AND_MANUAL_RECOVERY',async()=>{
      await b('识别不完整').click();
      const notice=await p.locator('#recognition-note').innerText();
      const retained=await p.locator('#ingredient-list input').evaluateAll(es=>es.map(e=>e.value));
      await p.locator('#new-ingredient').fill('土豆200g');await b('添加食材').click();await generate();
      return {notice,retained,edited:await p.locator('#ingredient-list input').evaluateAll(es=>es.map(e=>e.value)),result:await p.locator('#result-content').innerText()};
    });
    await check('UNCERTAIN_ALLERGEN_CANDIDATES',async()=>{
      await b('✧ 没想好？用示例食材试一试 →').click();
      await p.getByRole('tab',{name:'多菜候选',exact:true}).click();
      if (!await p.locator('#quick-allergies').isVisible()) await p.locator('.secondary-settings summary').click();
      await p.locator('#quick-allergies').fill('');await p.locator('#quick-allergies').blur();
      await generate();
      if(await p.locator('#browse-buy').isVisible())await p.locator('#browse-buy').check();else await b('接受补买').click();
      await ready();
      const allCards=async()=>{const names=[];while(true){names.push(...await p.locator('#result-content .recipe-card h3').allTextContents());const next=b('下一页 →');if(await next.isDisabled())break;await next.click();}return names;};
      const baseline=await allCards();
      await p.locator('#quick-allergies').fill('鸡蛋');await p.locator('#quick-allergies').blur();await generate();
      const restricted=await allCards();
      return {baseline,restricted,meta:await p.locator('#result-meta').innerText()};
    });
    await check('CONFLICT_EXIT_TO_ORDINARY',async()=>{
      await b('多疾病冲突').click();await ready();const conflict=await p.locator('#result-content').innerText();
      await b('切回普通推荐').click();await ready();
      return {conflict,recoveredMeta:await p.locator('#result-meta').innerText(),recoveredCards:await p.locator('#result-content .recipe-card h3').allTextContents()};
    });
    await ctx.close();
  }
  report.finished=new Date().toISOString();save();await browser.close();
})().catch(async e=>{report.fatal=e.stack;save();if(browser)await browser.close();process.exitCode=1;});
