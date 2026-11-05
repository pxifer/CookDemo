import {readFile,writeFile} from 'node:fs/promises';
import {CloudBaseGalleryRepository} from '../backend/src/cloudbase-content';
import {GALLERY_RELEASE} from '../backend/src/gallery-content';
import {contentContext} from '../shared/content';
import {defaultMeal} from '../shared/types';
import {checkDish,recommend} from '../backend/src/recommendation';

async function main(){
  const config=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261024-account-v11/cloudbaserc.json','utf8'));
  const vars=config.functions[0].envVariables;
  const repository=new CloudBaseGalleryRepository({envId:vars.CLOUDBASE_ENV_ID,publishableKey:vars.CLOUDBASE_PUBLISHABLE_KEY,releaseId:vars.CONTENT_BUNDLE_ID,hash:vars.CONTENT_BUNDLE_SHA256,compositionReleaseId:vars.COMPOSITION_RELEASE_ID,compositionHash:vars.COMPOSITION_RELEASE_SHA256});
  const snapshot=await repository.load(GALLERY_RELEASE),context=contentContext(snapshot);
  const meal={...defaultMeal(),checkSeasonings:false,ingredients:['牛肉','鱼','玉米','白菜','鸡蛋','西红柿','金针菇'].map((name,index)=>({id:`synthetic-${index}`,foodId:context.findFood(name)!.id,name,amount:'',basis:'unknown' as const,form:'raw',status:'confirmed' as const,original:name})),restrictions:['鱼','玉米'].map(name=>({id:name,kind:'allergy' as const,name,targets:context.restrictionTargets(name),status:'confirmed' as const,scope:'self' as const,original:name}))};
  const result=await recommend(context.recipes,{operationId:'public-evidence-check',meal,action:'generate',page:0,selected:[],previous:[]},{context});
  if(result.status!=='completed'||!result.dishes.length)throw Error('NO_RECOMMENDATION');
  const blocked=[];
  for(const [recipeName,target] of [['松仁玉米','玉米'],['炸洋葱花','玉米'],['醉排骨','鱼']]){
    const recipe=context.recipes.find(recipe=>recipe.name===recipeName)!;
    const checked=checkDish(recipe,recipe.variants[0],{...meal,allowBuy:true,restrictions:[{...meal.restrictions[0],name:target,targets:context.restrictionTargets(target)}]},context);
    if(checked.dish||!checked.reasons.some(reason=>reason.includes('含有需避开')))throw Error('DERIVATIVE_NOT_EXCLUDED');
    blocked.push(recipeName);
  }
  const afterRetire=process.argv.includes('--after-retire');
  let supersededVersionsWithdrawn:boolean|undefined;
  if(afterRetire){
    const response=await fetch(`https://${vars.CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest/shiwei_gallery_releases?release_id=in.(composition-review-20261024-v2,composition-review-20261024-v3)&select=release_id,published`,{headers:{Authorization:`Bearer ${vars.CLOUDBASE_PUBLISHABLE_KEY}`},signal:AbortSignal.timeout(8000),redirect:'error'});
    if(!response.ok||(await response.json()).length!==0)throw Error('INTERMEDIATE_RELEASE_VISIBLE');
    supersededVersionsWithdrawn=true;
  }
  const report={databaseReadback:true,releaseId:vars.COMPOSITION_RELEASE_ID,hash:vars.COMPOSITION_RELEASE_SHA256,recipes:snapshot.recipes.length,compositionApprovals:snapshot.compositionApprovals?.length,syntheticFishCornNoBuying:result.dishes.map(dish=>dish.recipe.name),knownDerivativeExclusions:blocked,supersededVersionsWithdrawn,rawCredentialsPrinted:false};
  await writeFile(`artifacts/acceptance/composition-v2-2026-10-24/cloud-database-readback-v4${afterRetire?'-final':''}.json`,JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify(report));
}
main().catch(()=>{console.error('COMPOSITION_CLOUD_VERIFICATION_FAILED');process.exitCode=1;});
