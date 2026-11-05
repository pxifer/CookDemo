import {expect,type Page,type Route} from '@playwright/test';
import type {RecommendationResult} from '../shared/types';
export async function addManualFood(page:Page,name:string){
  const details=page.locator('.food-picker-manual');
  if(!await details.evaluate(element=>element.hasAttribute('open')))await details.locator('summary').click();
  const input=details.getByLabel('手动添加食材',{exact:true});await input.fill(name);await input.press('Enter');
}
export async function recommendationAfter(page:Page,action:()=>Promise<unknown>,kind:'generate'|'variant'):Promise<RecommendationResult>{
  // APIResponse retains its body independently of Chromium's consumed stream.
  // Forward the real server response once. Streaming-specific tests use their
  // original browser requests, without this buffered assertion helper.
  let resolve!:(value:RecommendationResult)=>void,reject!:(error:unknown)=>void,claimed=false;
  const result=new Promise<RecommendationResult>((yes,no)=>{resolve=yes;reject=no;});void result.catch(()=>{});
  const timeout=setTimeout(()=>reject(Error(`Recommendation response was not captured: ${kind}`)),15000);
  const handler=async(route:Route)=>{
    const request=route.request();
    if(claimed||request.method()!=='POST'||request.postDataJSON()?.action!==kind){await route.fallback();return;}
    claimed=true;
    try{
      const response=await route.fetch({maxRedirects:0,maxRetries:0});
      try{
        const body=await response.text();await route.fulfill({response,body});expect(response.ok()).toBe(true);
        const events=body.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
        const error=events.find(event=>event.type==='error');if(error)throw Error(`Recommendation failed: ${error.code}: ${error.message}`);
        const terminal=events.filter(event=>event.type==='result');expect(terminal).toHaveLength(1);expect(events.at(-1).type).toBe('result');
        resolve(terminal[0].result);
      }finally{await response.dispose();}
    }catch(error){await route.abort().catch(()=>{});reject(error);}
  };
  try{await page.route('**/api/v1/recommendations',handler);await action();return await result;}finally{clearTimeout(timeout);await page.unroute('**/api/v1/recommendations',handler);}
}
export async function openSavedRecipe(page:Page,name:string){
  const result=await recommendationAfter(page,()=>page.locator('.saved-recipes .favorite-open').filter({hasText:name}).click(),'variant');
  expect(result.dishes.some(dish=>dish.recipe.name===name)).toBe(true);
  const dialog=page.getByRole('dialog',{name,exact:true});await expect(dialog.getByText('正在按当前食材与饮食要求重新核对…',{exact:true})).toHaveCount(0);
  await expect(dialog).not.toContainText('当前适用性无法核验');return dialog;
}
