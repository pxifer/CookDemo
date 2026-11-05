import type { ContentContext } from '../../../shared/content';
import type { HealthChatReply, HealthChatRequest, FoodSuggestion } from '../../../shared/health-chat';
import type { FoodGuidanceProvider,FoodGuidancePacket } from '../../../shared/food-guidance';
import { readFoodGuidanceAssets } from './food-guidance-repository';
import { guidanceProfile, reportedConditions } from './food-guidance';

const conditionLabels:Record<string,string>={adult:'是否为成年人',healthyExerciser:'是否属于无已知疾病的健康运动人群',resistanceTraining:'是否进行抗阻/力量训练',complexComorbidity:'是否有复杂合并症',pregnantOrLactating:'是否处于妊娠或哺乳期',renalFunction:'肾功能情况',hyperkalemia:'是否存在高钾血症',ckdStage:'慢性肾病分期',dialysis:'是否透析',clinicianNutritionPlan:'是否有个体营养方案',lipidPattern:'血脂异常分型（高胆固醇、高甘油三酯或混合型；不清楚可直接说不清楚）'};
function explicitFollowup(body:HealthChatRequest){
  const last=body.messages.at(-1)!.content.trim(),previous=body.messages.at(-2);
  if(previous?.role!=='assistant')return last;
  const pairs:Record<string,[string,string]>={adult:['我已成年','我未成年'],healthyExerciser:['我身体健康','我身体不健康'],resistanceTraining:['我规律抗阻训练','我不做抗阻训练'],complexComorbidity:['我有复杂合并症','我没有复杂合并症'],pregnantOrLactating:['我处于妊娠或哺乳期','我未孕且未哺乳'],hyperkalemia:['我有高钾血症','我没有高钾血症'],dialysis:['我正在透析','我未透析'],clinicianNutritionPlan:['我有个体营养方案','我没有个体营养方案']};
  const key=Object.keys(conditionLabels).find(key=>previous.content.endsWith(`还需确认：${conditionLabels[key]}。`));
  if(!key)return last;
  if(pairs[key]&&/^(是|是的|对|有|是这样)[。！!]?$/u.test(last))return pairs[key][0];
  if(pairs[key]&&/^(否|不是|没有|不)[。！!]?$/u.test(last))return pairs[key][1];
  if(key==='adult'&&/^(不清楚|不知道)/.test(last))return '我不清楚是否为成年人';
  if(key==='healthyExerciser'&&/^(不清楚|不知道)/.test(last))return '我不清楚是否健康';
  if(key==='ckdStage'&&/^G[1-5]$/i.test(last))return `我已知分期${last.toUpperCase()}`;
  if(key==='lipidPattern'){
    if(/^(高胆固醇(?:血症)?|高甘油三酯(?:血症)?|混合型)[。！!]?$/u.test(last))return `我已知血脂分型是${last.replace(/[。！!]/g,'')}`;
    if(/^(不清楚|不知道|尚未检查)[。！!]?$/u.test(last))return '我不清楚血脂分型';
  }
  return last;
}
/** Round-robin directions, then distinct topic/object buckets; no category can consume the cap first. */
export function balancedFoodSuggestions(packet:FoodGuidancePacket,content:ContentContext,excluded:string[],limit=20):FoodSuggestion[]{
  const groups=new Map<string,{direction:'prefer'|'limit'|'avoid';items:FoodSuggestion[]}>();
  for(const g of packet.guidance.filter(g=>g.applicability==='applicable'&&g.objectKind!=='process')){
    const key=`${g.direction}:${g.topic.id}:${g.objectId}`;
    if(!groups.has(key))groups.set(key,{direction:g.direction,items:[]});
    const bucket=groups.get(key)!;
    for(const id of g.mapping.foodIds){
      const food=content.foodById.get(id);if(!food||excluded.includes(id)||bucket.items.some(s=>s.foodName===food.name))continue;
      bucket.items.push({foodName:food.name,direction:g.direction,reason:g.statement,conditions:'依据本次明确条件作定性参考，未计算个人摄入量。',matchable:true,topics:[`${g.topic.kind}:${g.topic.inputName}`]});
    }
  }
  const result:FoodSuggestion[]=[],seen=new Set<string>();
  const directions=(['avoid','limit','prefer'] as const).map(direction=>({buckets:[...groups.values()].filter(g=>g.direction===direction),next:0}));
  while(result.length<limit){let added=false;
    for(const pool of directions){
      for(let n=0;n<pool.buckets.length;n++){
        const bucket=pool.buckets[pool.next++%pool.buckets.length];let item:FoodSuggestion|undefined;
        while((item=bucket.items.shift())){const key=`${item.foodName}:${item.direction}:${item.topics?.join('|')}`;if(seen.has(key))continue;seen.add(key);break;}
        if(item){result.push(item);added=true;break;}
      }
      if(result.length===limit)break;
    }
    if(!added)break;
  }
  return result;
}
export async function researchFoodChat(body:HealthChatRequest,content:ContentContext,provider:FoodGuidanceProvider):Promise<HealthChatReply>{
  const assets=await readFoodGuidanceAssets(),text=explicitFollowup(body);
  const profile=guidanceProfile(body.profile??{conditions:body.diseases,goals:[],notes:''},text,assets.bundle,assets.goals);
  const reports=text.split(/[。；，\n]/).filter(part=>Object.keys(reportedConditions(part)).length).join('；');
  if(reports&&!profile.notes.includes(reports)&&profile.notes.length+reports.length<390)profile.notes=[profile.notes,reports].filter(Boolean).join('；');
  const packet=await provider.prepare({profile,content,currentText:text});
  const names=[...new Set((body.mealContext?.restrictions??[]).flatMap(name=>content.restrictionTargets(name.replace(/^(过敏|忌口|待确认)：/,''))))];
  const suggestions=balancedFoodSuggestions(packet,content,names);
  const known=reportedConditions(profile.notes,text);
  const missing=packet.guidance.filter(g=>g.applicability==='needs_confirmation'&&g.mapping.status==='mapped').flatMap(g=>g.missingConditions).find(key=>conditionLabels[key]&&known[key]!=='unknown');
  const question=missing?`还需确认：${conditionLabels[missing]}。`:packet.missingConditions.length?'尚不明确的条件只保留相关判断，你之后可以补充。':'';
  const reply=suggestions.length?`已按当前疾病或目标整理有来源的食材建议，可分别接受或取消，再结合本餐食材选择菜品。${question}`:packet.guidance.some(g=>g.applicability==='applicable')?`已有适用的做法指导，实际选菜时会核对配方步骤。${question}`:question||'当前资料尚未覆盖可用于本餐的指导，请明确疾病或饮食目标；未自动改动你的设置。';
  await provider.assertCurrent(packet);
  return {operationId:body.operationId,knowledge:'research_rag',message:{role:'assistant',content:reply},assessment:{profile,stage:suggestions.length?'advice':'clarify',suggestions:suggestions.slice(0,20)},researchGuidance:packet};
}
