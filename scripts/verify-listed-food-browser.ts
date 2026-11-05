import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const origin='https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com';
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]] as const){
    const context=await browser.newContext({viewport:{width,height},locale:'zh-CN',reducedMotion:'reduce'});
    const page=await context.newPage();page.setDefaultTimeout(20000);
    await page.goto(`${origin}/recipes?q=${encodeURIComponent('蒜薹肉丝')}`);
    const confirmation=page.getByRole('button',{name:'确定访问',exact:true});
    await confirmation.or(page.locator('.site-header')).first().waitFor();
    if(await confirmation.isVisible())await confirmation.click();
    await page.locator('.site-header').waitFor();
    await page.locator('.candidate-card').first().waitFor();
    assert.equal(await page.locator('.candidate-card').count(),1);
    assert((await page.locator('.candidate-card').innerText()).includes('蒜薹肉丝'));
    await page.getByRole('button',{name:'查看做法 ↗',exact:true}).click();
    await page.locator('.library-recipe-columns').waitFor();
    assert((await page.locator('.library-recipe-columns').innerText()).includes('猪里脊'));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`artifacts/acceptance/listed-foods-v27/${name}-recipe.png`,fullPage:true});
    await page.goto(origin);
    await page.locator('.site-header').waitFor();
    await page.getByRole('button',{name:/过敏/}).first().click();
    const dialog=page.getByRole('dialog');
    assert((await dialog.innerText()).includes('按菜谱列出的食材和调料筛选'));
    await page.getByLabel('过敏食物',{exact:true}).fill('猪肉');
    await dialog.getByRole('button',{name:'确认添加',exact:true}).click();
    const confirmScope=dialog.getByRole('button',{name:'确认避开这些食物',exact:true});
    if(await confirmScope.isVisible())await confirmScope.click();
    assert((await dialog.innerText()).includes('猪肉'));
    await page.screenshot({path:`artifacts/acceptance/listed-foods-v27/${name}-restriction.png`,fullPage:true});
    results.push({name,newRecipeVisible:true,methodAndIngredientsVisible:true,restrictionScopeVisible:true,restrictionAdded:true,noOverflow:true});
    await context.close();
  }
}finally{await browser.close();}
await writeFile('artifacts/acceptance/listed-foods-v27/browser-verification.json',JSON.stringify({origin,results,realAccountsUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({results,realAccountsUsed:false}));
