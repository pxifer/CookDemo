import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { contentContext,type ContentSnapshot } from '../shared/content';
import { defaultMeal } from '../shared/types';
import { extractText } from '../shared/extraction';
import { checkDish } from '../backend/src/recommendation';
import { createHealthRecipeSelector } from '../backend/src/health-recipe-selection';
const dataset=JSON.parse(await readFile('datasets/evaluation/agent-candidates-v1.json','utf8'));
const snapshot:ContentSnapshot=JSON.parse(await readFile('datasets/evaluation/catalog-snapshot-v1.json','utf8')),context=contentContext(snapshot);
const rows=[];
for(const task of dataset.cases){
  if(task.dimension==='recognition'){
    const actual=extractText(task.input.text,context);rows.push({id:task.id,dimension:task.dimension,state:actual.ingredients.some(i=>i.foodId===task.expectation.foodId&&i.amount===task.expectation.amount)?'contract_passed':'needs_triage',expected:task.expectation,actual:actual.ingredients.map(i=>({foodId:i.foodId,amount:i.amount,status:i.status}))});
  }else if(task.dimension==='allergy'){
    const meal={...defaultMeal(),allowBuy:task.input.allowBuy,restrictions:[{id:task.id,kind:task.input.kind,name:task.input.foodName,targets:[task.expectation.listedFoodId],status:'confirmed' as const,scope:'self' as const,original:'构造限制'}]};
    const violations=task.expectation.forbiddenVariants.filter((item:{recipeId:string;variantId:string})=>{const r=context.recipes.find(r=>r.id===item.recipeId)!,v=r.variants.find(v=>v.id===item.variantId)!;return Boolean(checkDish(r,v,meal,context).dish);});
    rows.push({id:task.id,dimension:task.dimension,state:violations.length?'needs_triage':'contract_passed',checkedVariants:task.expectation.forbiddenVariants.length,violations});
  }else if(task.dimension==='method'){
    const recipe=context.recipes.find(r=>r.id===task.input.recipeId)!,variant=recipe.variants.find(v=>v.id===task.input.variantId)!;
    let inspected=false,complete=false;
    const meal={...defaultMeal(),health:true,allowBuy:true,composition:'custom' as const,counts:{meat:0,veg:0,soup:0}};meal.counts[recipe.category]=1;
    try{await createHealthRecipeSelector(randomBytes(32))({request:{operationId:crypto.randomUUID(),meal,action:'generate',selected:[],previous:[],page:0},owner:'synthetic-candidate-evaluation',apiKey:'sk-synthetic-candidate-evaluation-only',context:{...context,recipes:[recipe]},signal:AbortSignal.timeout(2000),present:d=>d,claim:async()=>{},progress:()=>{},fetcher:async(_url,init)=>{
      const p=JSON.parse(JSON.parse(String(init?.body)).messages.at(-1).content),offered=p.catalog.find((item:any)=>item.flavor===variant.flavor);inspected=true;
      complete=Boolean(offered&&JSON.stringify(offered.steps)===JSON.stringify(variant.steps)&&JSON.stringify(offered.methodOptions??[])===JSON.stringify((variant.methodOptions??[]).map(m=>({label:m.label,steps:m.steps}))));
      return Response.json({id:'synthetic-method-contract',model:'deepseek-flash',usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'构造协议检查',choices:[{id:p.catalog[0].id,reason:'构造完整做法核对'}]})}}]});
    }});}catch{}
    rows.push({id:task.id,dimension:task.dimension,state:inspected&&complete?'contract_passed':'needs_triage',inspected,complete});
  }else rows.push({id:task.id,dimension:task.dimension,state:'requires_independent_quality_review'});
}
const report={dataset:dataset.id,sourceContentVersion:snapshot.contentVersion,total:rows.length,automaticContracts:rows.filter(r=>r.state==='contract_passed').length,needsTriage:rows.filter(r=>r.state==='needs_triage').length,pendingIndependentQuality:rows.filter(r=>r.state==='requires_independent_quality_review').length,independentAnnotationsPending:rows.length,qualityPassed:null,realProviderCalls:0,rows,note:'All 200 annotations still require independent review, including the 120 automatic contract checks. Triage may identify annotation or implementation errors; no independent benchmark or model-quality claim.'};
const out=resolve(process.env.AGENT_EVALUATION_DIR??`artifacts/acceptance/agent-candidates-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(out,{recursive:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,automaticContracts:report.automaticContracts,needsTriage:report.needsTriage,pendingIndependentQuality:report.pendingIndependentQuality,qualityPassed:null,report:join(out,'report.json')}));
