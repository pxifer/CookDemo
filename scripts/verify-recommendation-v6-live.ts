import {readFile,writeFile} from 'node:fs/promises';
import {contentContext} from '../shared/content';
import {defaultMeal} from '../shared/types';

async function main(){
  const config=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261024-account-v14/cloudbaserc.json','utf8'));
  const env=config.functions[0].envVariables,origin=env.APP_ORIGIN;
  const catalogResponse=await fetch(`${origin}/api/v1/catalog/recipes`,{signal:AbortSignal.timeout(15000)});
  if(!catalogResponse.ok)throw Error(`CATALOG_HTTP_${catalogResponse.status}`);
  const catalog=await catalogResponse.json() as any,context=contentContext(catalog);
  const sessionResponse=await fetch(`${origin}/api/v1/auth/session`,{signal:AbortSignal.timeout(15000)});
  if(!sessionResponse.ok)throw Error(`SESSION_HTTP_${sessionResponse.status}`);
  const session=await sessionResponse.json() as {csrfToken:string};
  const cookie=sessionResponse.headers.get('set-cookie')?.split(';',1)[0];
  if(!session.csrfToken||!cookie)throw Error('ANONYMOUS_SESSION_MISSING');
  const pantryNames=['牛肉','鱼','玉米','白菜','鸡蛋','西红柿','金针菇'];
  const ingredients=pantryNames.map((name,index)=>{const food=context.findFood(name);if(!food)throw Error(`PANTRY_FOOD_MISSING_${index}`);return {id:`v6-live-${index}`,foodId:food.id,name,amount:'',basis:'unknown' as const,form:'raw',status:'confirmed' as const,original:name};});
  const allRestrictedIds=new Set([...context.restrictionTargets('鱼'),...context.restrictionTargets('玉米')]);
  const results=[] as {fishKind:string;cornKind:string;allowBuy:boolean;names:string[];excludedRestrictedFoods:boolean}[];
  for(const [fishKind,cornKind,allowBuy] of [['allergy','avoid',false],['avoid','allergy',false],['allergy','avoid',true],['avoid','allergy',true]] as const){
    const meal={...defaultMeal(),mode:'candidates' as const,allowBuy,checkSeasonings:false,ingredients,
      restrictions:[{id:'fish',kind:fishKind,name:'鱼',targets:context.restrictionTargets('鱼'),status:'confirmed' as const,scope:'self' as const,original:'鱼'},
        {id:'corn',kind:cornKind,name:'玉米',targets:context.restrictionTargets('玉米'),status:'confirmed' as const,scope:'self' as const,original:'玉米'}]};
    const response=await fetch(`${origin}/api/v1/recommendations`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','x-csrf-token':session.csrfToken},body:JSON.stringify({operationId:`v6-live-${fishKind}-${cornKind}-${allowBuy}`,meal,action:'generate',page:0,selected:[],previous:[],contentVersion:catalog.contentVersion}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error(`RECOMMENDATION_HTTP_${response.status}`);
    const result=await response.json() as any;
    if(result.status!=='completed')throw Error(`RECOMMENDATION_STATUS_${result.status}`);
    const excludedRestrictedFoods=result.dishes.every((dish:any)=>dish.variant.lines.every((line:any)=>!context.components(line.foodId).some(food=>allRestrictedIds.has(food.id))));
    if(!excludedRestrictedFoods)throw Error('RESTRICTED_FOOD_RETURNED');
    results.push({fishKind,cornKind,allowBuy,names:result.dishes.map((dish:any)=>dish.recipe.name),excludedRestrictedFoods});
  }
  const report={liveHttp:true,releaseId:env.COMPOSITION_RELEASE_ID,releaseHash:env.COMPOSITION_RELEASE_SHA256,recipeCount:catalog.recipes.length,
    pantryNames,results,fishAllergyAndAvoidModesVerified:true,cornAllergyAndAvoidModesVerified:true,credentialsPrinted:false};
  await writeFile('artifacts/acceptance/composition-source-review-2026-10-24/recommendation-live-v6.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(report));
}
main().catch(error=>{const value=error as {message?:string};console.error(JSON.stringify({error:'LIVE_RECOMMENDATION_V6_FAILED',message:(value.message??'').slice(0,120)}));process.exitCode=1;});
