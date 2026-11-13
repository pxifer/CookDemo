import {test,expect} from './local-browser';
import {readFile} from 'node:fs/promises';
test('1000道图鉴：分页、搜索、新菜做法、收藏、刷新和缺图占位',async({page},info)=>{
 const records=JSON.parse(await readFile('datasets/recipes/expansion-1000/source-records.json','utf8'));const name=records[0].recipeName;
 await page.goto('/recipes');await expect(page.locator('.candidate-library-count')).toContainText('1000 道菜');await expect(page.locator('.candidate-card')).toHaveCount(24);
 await page.getByRole('navigation',{name:'图鉴分页'}).getByRole('button',{name:'下一页',exact:true}).click();await expect(page.getByRole('navigation',{name:'图鉴分页'})).toContainText('2 / 42');
 await page.getByRole('searchbox',{name:'搜索菜名'}).fill(name);await expect(page.locator('.candidate-card')).toHaveCount(1);await expect(page.locator('.candidate-no-photo')).toContainText(name);
 await page.getByRole('button',{name:`查看${name}做法`,exact:true}).click();await expect(page.locator('.library-recipe-detail h2')).toHaveText(name);expect(await page.locator('.library-recipe-detail ol li').count()).toBeGreaterThanOrEqual(3);
 await page.getByRole('button',{name:'收藏此口味 ♡',exact:true}).click();await expect(page.getByRole('button',{name:'已收藏 · 点击取消 ♥',exact:true})).toBeVisible();
 await expect(page.locator('.library-route-status')).toContainText('可在「我的收藏」查看');await expect(page.getByRole('button',{name:'已收藏 · 点击取消 ♥',exact:true})).toBeEnabled();await page.reload();await expect(page.getByRole('button',{name:'已收藏 · 点击取消 ♥',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.local-data/recipe1000-browser/${info.project.name}-new-recipe.png`,fullPage:true});
 await page.goto('/favorites');await expect(page.locator('.favorite-row')).toContainText(name);await page.locator('.favorite-open').click();await expect(page.getByRole('dialog')).toContainText(name);
});
test('1000道目录正常搭配与补买，模型不会被普通推荐调用',async({page},info)=>{
 let modelCalls=0;page.on('request',r=>{if(r.url().includes('/health/chat')||r.url().includes('/recognitions/image'))modelCalls++;});
 await page.goto('/');await page.getByLabel('允许补买食材',{exact:false}).check();await page.getByRole('button',{name:'安排这一餐',exact:true}).click();await expect(page.getByTestId('recipe-card')).toHaveCount(6);
 const before=await page.getByTestId('recipe-card').allTextContents();await page.locator('.result-actions').getByRole('button',{name:'下一页',exact:true}).click();await expect.poll(async()=>JSON.stringify(await page.getByTestId('recipe-card').allTextContents())).not.toBe(JSON.stringify(before));
 expect(modelCalls).toBe(0);await page.screenshot({path:`.local-data/recipe1000-browser/${info.project.name}-recommendation.png`,fullPage:true});
});
