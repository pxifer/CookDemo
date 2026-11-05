import {readFile,writeFile} from 'node:fs/promises';
import {CloudBaseGalleryRepository} from '../backend/src/cloudbase-content';
import {GALLERY_RELEASE} from '../backend/src/gallery-content';
import {contentContext} from '../shared/content';
import {defaultMeal} from '../shared/types';
import {recommend} from '../backend/src/recommendation';
import {compositionHash} from '../backend/src/composition-review';
async function main(){
  const config=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261024-account-v12/cloudbaserc.json','utf8'));
  const vars=config.functions[0].envVariables;
  const meta=await fetch(`https://${vars.CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest/shiwei_gallery_releases?release_id=eq.${encodeURIComponent(vars.COMPOSITION_RELEASE_ID)}&published=eq.true&select=payload`,{headers:{Authorization:`Bearer ${vars.CLOUDBASE_PUBLISHABLE_KEY}`},signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!meta.ok)throw Object.assign(new Error('RELEASE_LOOKUP_FAILED'),{code:`RELEASE_LOOKUP_HTTP_${meta.status}`});
  const rows=await meta.json() as {payload:unknown}[];
  if(rows.length!==1||compositionHash(rows[0].payload)!==vars.COMPOSITION_RELEASE_SHA256)throw Object.assign(new Error('RELEASE_NOT_PUBLISHED'),{code:`RELEASE_PAYLOAD_${rows.length}_${rows[0]?'HASH_MISMATCH':'MISSING'}`});
  const repo=new CloudBaseGalleryRepository({envId:vars.CLOUDBASE_ENV_ID,publishableKey:vars.CLOUDBASE_PUBLISHABLE_KEY,
    releaseId:vars.CONTENT_BUNDLE_ID,hash:vars.CONTENT_BUNDLE_SHA256,compositionReleaseId:vars.COMPOSITION_RELEASE_ID,compositionHash:vars.COMPOSITION_RELEASE_SHA256});
  const snapshot=await repo.load(GALLERY_RELEASE),context=contentContext(snapshot);
  const cases=[['allergy','avoid'],['avoid','allergy']] as const;const eligible:string[][]=[];
  for(const [fishKind,cornKind] of cases){
    const meal={...defaultMeal(),checkSeasonings:false,ingredients:['牛肉','鱼','玉米','白菜','鸡蛋','西红柿','金针菇'].map((name,index)=>({id:`verification-${index}`,foodId:context.findFood(name)!.id,name,amount:'',basis:'unknown' as const,form:'raw',status:'confirmed' as const,original:name})),
      restrictions:[{id:'fish',kind:fishKind,name:'鱼',targets:context.restrictionTargets('鱼'),status:'confirmed' as const,scope:'self' as const,original:'鱼'},
        {id:'corn',kind:cornKind,name:'玉米',targets:context.restrictionTargets('玉米'),status:'confirmed' as const,scope:'self' as const,original:'玉米'}]};
    const result=await recommend(context.recipes,{operationId:`cloud-composition-v6-${fishKind}`,meal,action:'generate',page:0,selected:[],previous:[]},{context});
    if(result.status!=='completed'||!result.dishes.length)throw Error('NO_SAFE_RECOMMENDATIONS');
    for(const dish of result.dishes)for(const check of dish.checks)if(context.components(check.foodId).some(food=>['鱼','玉米'].includes(food.name)))throw Error('RESTRICTED_FOOD_RETURNED');
    eligible.push(result.dishes.map(dish=>dish.recipe.name));
  }
  const report={databaseReadback:true,releaseId:vars.COMPOSITION_RELEASE_ID,hash:vars.COMPOSITION_RELEASE_SHA256,
    recipeCount:snapshot.recipes.length,variantCount:snapshot.recipes.flatMap(recipe=>recipe.variants).length,
    verifiedIngredientIdentities:snapshot.verifiedIngredientIdentities?.length,fishAllergyAndCornAvoidEligible:eligible[0],fishAvoidAndCornAllergyEligible:eligible[1],
    bothRestrictionModesPassed:true,excludedIngredientsChecked:true,rawCredentialsPrinted:false};
  await writeFile('artifacts/acceptance/composition-source-review-2026-10-24/cloud-database-readback-v6.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(report));
}
main().catch(error=>{const value=error as {name?:string;message?:string;code?:string;statusCode?:number};console.error(JSON.stringify({error:'COMPOSITION_V6_CLOUD_VERIFICATION_FAILED',name:value.name??'Error',message:(value.message??'').slice(0,180),code:value.code??'UNKNOWN',statusCode:value.statusCode??null}));process.exitCode=1;});
