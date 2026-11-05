import type {Meal,QuantityCheck} from './types';

/** Pantry amounts are reference text, never recommendation constraints. */
export function recommendationMeal(meal:Meal):Meal {
  return {...meal,raw:'',ingredients:meal.ingredients.map(item=>({
    ...item,amount:'',quantityUnit:undefined,basis:'unknown',original:item.name,alternative:undefined,
    status:item.status==='conflict'&&item.foodId?'confirmed':item.status,
  }))};
}
export function sameRecommendationInput(a:Meal,b:Meal){
  return JSON.stringify({...recommendationMeal(a),version:0})===JSON.stringify({...recommendationMeal(b),version:0});
}
/** Preserve missing-food checks without implying a measured stock surplus/gap. */
export function recommendationChecks(checks:QuantityCheck[]):QuantityCheck[]{
  const found=new Map<string,QuantityCheck>();
  for(const check of checks){
    const missing=check.state==='missing';
    const reason=missing?(check.reason.includes('调味料')?'缺少必需调味料':'清单中没有此食材'):check.reason.includes('填写用量仅供参考')?check.reason:check.reason.includes('大类匹配')?check.reason.replace('和用量','')+'；填写用量仅供参考':'已匹配本餐食材；填写用量仅供参考，不参与选菜';
    const value:QuantityCheck={...check,needed:null,available:missing?0:null,shortage:null,unit:'有无',state:missing?'missing':'unverified',reason};
    if(!found.has(check.foodId)||missing)found.set(check.foodId,value);
  }
  return [...found.values()];
}
