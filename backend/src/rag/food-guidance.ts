import { createHash } from 'node:crypto';
import type { KnowledgeBundle, KnowledgeFact } from '../../../shared/health-knowledge';
import type { ContentContext } from '../../../shared/content';
import type { HealthContext } from '../../../shared/health-chat';
import type { Recipe, Variant } from '../../../shared/types';
import type { FoodGuidance, FoodGuidancePacket, FoodGuidanceProvider, GuidanceEvidence, GuidanceInput, GuidanceTopic, RecipeGuidanceBinding } from '../../../shared/food-guidance';
import { factAvailability, canonicalKnowledgeHash } from '../health-knowledge';

export const businessPolicyVersion='food-guidance-business-v1';
export const guidanceHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const guidanceTextHash=(value:string)=>createHash('sha256').update(value).digest('hex');
const norm=(value:string)=>value.normalize('NFKC').trim();
export interface GoalKnowledge {
  id:string; topics:{id:string;name:string;aliases:string[]}[]; evidence:GuidanceEvidence[];
  facts:{id:string;topicId:string;objectId:string;objectName:string;objectKind:'food'|'food_group'|'process';direction:'prefer'|'limit'|'avoid';statement:string;conditions:{key:string;values:string[]}[];evidenceIds:string[];qualifyingEvidenceIds:string[];basis:'source_statement'|'project_interpretation'}[];
}
export interface GuidanceMappings {id:string; objects:Record<string,{names:string[];processRule?:string;note:string}>}

/** Only explicit self reports; absence is never turned into a negative diagnosis. */
export function reportedConditions(notes:string, currentText=''):Record<string,string>{
  const parse=(text:string)=>{const result:Record<string,string>={};
  const ages=[...text.matchAll(/(?:我(?:今年|是)?|年龄[:：]?)(\d{1,3})岁/g)].map(m=>Number(m[1]));
  if(/(?:本人|我)(?:已成年|是成年人|是成人)/.test(text)||ages.some(n=>n>=18&&n<=120))result.adult='yes';
  if(/(?:本人|我)(?:未成年|是未成年人)/.test(text)||ages.some(n=>n<18))result.adult='no';
  if(/(?:本人|我)(?:不清楚|不知道)是否为成年人/.test(text))result.adult='unknown';
  if(/(?:本人|我)(?:身体健康|没有已知疾病|无已知疾病)/.test(text))result.healthyExerciser='yes';
  if(/(?:本人|我)(?:身体不健康|不是健康人|有已知疾病|有肾病)/.test(text))result.healthyExerciser='no';
  if(/(?:本人|我)(?:不清楚|不知道)(?:是否有疾病|是否健康)/.test(text))result.healthyExerciser='unknown';
  if(/(?:本人|我)(?:正在|有|坚持|规律进行|规律)(?:抗阻训练|力量训练)/.test(text))result.resistanceTraining='yes';
  if(/(?:本人|我)(?:没有|不做|未进行)(?:抗阻训练|力量训练)/.test(text))result.resistanceTraining='no';
  if(/(?:本人|我)(?:未孕且未哺乳|未怀孕且未哺乳)/.test(text))result.pregnantOrLactating='no';
  if(/(?:本人|我)处于妊娠或哺乳期/.test(text))result.pregnantOrLactating='yes';
  if(/(?:本人|我)(?:没有|无)复杂合并症/.test(text))result.complexComorbidity='no';
  if(/(?:本人|我)有复杂合并症/.test(text))result.complexComorbidity='yes';
  if(/(?:本人|我)(?:已知|检查提示|检查显示)?肾功能正常/.test(text))result.renalFunction='normal';
  if(/(?:本人|我)(?:没有|无)高钾血症/.test(text))result.hyperkalemia='no';
  if(/(?:本人|我)有高钾血症/.test(text))result.hyperkalemia='yes';
  if(/(?:本人|我)(?:未透析|没有透析)/.test(text))result.dialysis='no';
  if(/(?:本人|我)正在透析/.test(text))result.dialysis='yes';
  if(/(?:本人|我)有个体营养方案/.test(text))result.clinicianNutritionPlan='yes';
  if(/(?:本人|我)没有个体营养方案/.test(text))result.clinicianNutritionPlan='no';
  const stage=text.match(/(?:已知|确诊|分期(?:为|是)?|慢性肾病|CKD)\s*(G[1-5])/i);if(stage)result.ckdStage=stage[1].toUpperCase();
  return result;};
  return Object.assign({},...norm(notes+'。'+currentText).split(/[。；，\n]/).map(parse));
}
function selfReport(text:string,name:string){
  const at=text.indexOf(name);if(at<0)return false;
  const before=text.slice(Math.max(0,at-12),at);
  return /我[^。！？?]{0,10}(?:想|希望|目标是|要|有|患有|确诊为|确诊了)$/.test(before)&&!/没有|不是|未患|如果|假如/.test(before);
}
export function guidanceProfile(profile:HealthContext,text:string,bundle:KnowledgeBundle,goals:GoalKnowledge):HealthContext{
  const result=structuredClone(profile);
  for(const entity of bundle.entities.filter(e=>e.kind==='disease'))for(const name of [entity.name,...entity.aliases])if(selfReport(text,name)&&!result.conditions.includes(entity.name))result.conditions.push(entity.name);
  for(const goal of goals.topics)for(const name of [goal.name,...goal.aliases])if(selfReport(text,name)&&!result.goals.includes(goal.name))result.goals.push(goal.name);
  return result;
}
export function createFoodGuidanceProvider(bundle:KnowledgeBundle,goals:GoalKnowledge,mappings:GuidanceMappings,revocations:()=>Promise<Set<string>>):FoodGuidanceProvider{
  const contentHash=canonicalKnowledgeHash(bundle),goalsHash=guidanceHash(goals),mapHash=guidanceHash(mappings);
  const evidenceById=new Map<string,GuidanceEvidence>(bundle.evidence.map(e=>{const s=bundle.sources.find(s=>s.id===e.sourceId)!;return [e.id,{id:e.id,sourceId:s.id,title:s.title,version:s.version,url:s.url,sourceHash:s.sourceHash,originalSpan:e.originalSpan,locator:e.locator,spanHash:e.spanHash} satisfies GuidanceEvidence] as const;}));
  for(const e of goals.evidence){if(evidenceById.has(e.id)||guidanceTextHash(e.originalSpan)!==e.spanHash)throw Error('GUIDANCE_GOAL_EVIDENCE_INVALID');evidenceById.set(e.id,e);}
  const fingerprint=(revoked:Set<string>)=>guidanceHash({businessPolicyVersion,contentHash,goalsHash,mapHash,revoked:[...revoked].sort()});
  const blockedEvidence=(id:string,revoked:Set<string>)=>{const e=evidenceById.get(id);return !e||[id,e.sourceId,`${e.sourceId}@${e.version}`,e.sourceHash].some(x=>revoked.has(x));};
  return {
    async prepare(input:GuidanceInput){
      const revoked=new Set([...bundle.revocations,...await revocations()]);
      const profile=guidanceProfile(input.profile,input.currentText??'',bundle,goals);
      const conditions={...reportedConditions(profile.notes,input.currentText),...input.conditions};
      // A disease profile cannot be silently treated as the healthy exercise population.
      if(profile.conditions.length)conditions.healthyExerciser='no';
      const topics:GuidanceTopic[]=[],uncoveredTopics:string[]=[],guidance:FoodGuidance[]=[];
      for(const [kind,names] of [['condition',profile.conditions],['goal',profile.goals]] as const)for(const inputName of names){
        const candidates=kind==='condition'?bundle.entities.filter(e=>e.kind==='disease'&&[e.name,...e.aliases].some(n=>norm(n)===norm(inputName))):goals.topics.filter(e=>[e.name,...e.aliases].some(n=>norm(n)===norm(inputName)));
        if(candidates.length!==1){uncoveredTopics.push(`${kind}:${inputName}`);continue;}
        const entity=candidates[0];if(topics.some(t=>t.id===entity.id))continue;
        const topic={id:entity.id,kind,name:entity.name,inputName};topics.push(topic);
        if(entity.id==='d:type2-diabetes')conditions.diabetesType='type2';
        if(entity.id==='d:primary-osteoporosis')conditions.osteoporosisType='primary';
        const rows=kind==='condition'?bundle.facts.filter(f=>f.kind==='food_guidance'&&f.subjectId===entity.id).map(f=>{
          const obj=bundle.entities.find(e=>e.id===f.objectId)!;
          return {id:f.id,objectId:obj.id,objectName:obj.name,objectKind:obj.kind as FoodGuidance['objectKind'],direction:f.predicate as FoodGuidance['direction'],statement:f.statement,conditions:f.conditions,evidenceIds:f.evidenceIds,qualifyingEvidenceIds:f.qualifyingEvidenceIds,basis:f.directness==='project_interpretation'?'project_interpretation' as const:'source_statement' as const,original:f};
        }):goals.facts.filter(f=>f.topicId===entity.id).map(f=>({...f,original:undefined}));
        if(!rows.length)uncoveredTopics.push(`${kind}:${inputName}`);
        for(const row of rows){
          const missingConditions=row.conditions.filter(c=>!conditions[c.key]||conditions[c.key]==='unknown').map(c=>c.key);
          let applicability:FoodGuidance['applicability']='applicable';
          if([row.original?bundle.id:goals.id,row.id].some(id=>revoked.has(id))||[...row.evidenceIds,...row.qualifyingEvidenceIds].some(id=>blockedEvidence(id,revoked)))applicability='withdrawn';
          else if(row.conditions.some(c=>conditions[c.key]&&conditions[c.key]!=='unknown'&&!c.values.includes(conditions[c.key])))applicability='not_applicable';
          else if(missingConditions.length)applicability='needs_confirmation';
          if(row.original){const state=factAvailability(bundle,row.original as KnowledgeFact,conditions,revoked);if(state==='withdrawn'||state==='evidence_missing')applicability='withdrawn';}
          const map=mappings.objects[row.objectId];
          // Canonical names only: an alias like “鸡胸肉” on a generic chicken record cannot prove skinlessness.
          const foodIds=map?input.content.foods.filter(f=>map.names.includes(f.name)&&!f.id.startsWith('query:')).map(f=>f.id):[];
          guidance.push({id:`guide:${row.id}`,factId:row.id,topic,objectId:row.objectId,objectName:row.objectName,objectKind:row.objectKind,direction:row.direction,statement:row.statement,conditions:row.conditions,applicability,missingConditions,evidenceIds:row.evidenceIds,qualifyingEvidenceIds:row.qualifyingEvidenceIds,mapping:{foodIds,...(map?.processRule?{processRule:map.processRule}:{}),status:foodIds.length||map?.processRule?'mapped':'unmapped'},basis:row.basis,clinicalReview:'pending'});
        }
      }
      const selectedEvidence=[...new Set(guidance.filter(g=>g.applicability!=='withdrawn').flatMap(g=>[...g.evidenceIds,...g.qualifyingEvidenceIds]))];
      const applicable=guidance.filter(g=>g.applicability==='applicable');
      for(const topic of topics)if(!applicable.some(g=>g.topic.id===topic.id)&&!uncoveredTopics.includes(`${topic.kind}:${topic.inputName}`))uncoveredTopics.push(`${topic.kind}:${topic.inputName}`);
      const conflicts=[...new Set(applicable.map(g=>g.objectId))].flatMap(objectId=>{const items=applicable.filter(g=>g.objectId===objectId);return items.some(g=>g.direction==='prefer')&&items.some(g=>g.direction!=='prefer')?[{objectId,guidanceIds:items.map(g=>g.id)}]:[];});
      return {mode:'local_research',clinicalRelease:null,knowledgeVersion:`${bundle.id}+${goals.id}+${mappings.id}`,fingerprint:fingerprint(revoked),topics,guidance,evidence:selectedEvidence.flatMap(id=>evidenceById.has(id)?[evidenceById.get(id)!]:[]),uncoveredTopics,missingConditions:[...new Set(guidance.filter(g=>g.applicability==='needs_confirmation').flatMap(g=>g.missingConditions))],conflicts,mappingCoverage:{total:guidance.length,mapped:guidance.filter(g=>g.mapping.status==='mapped').length,unmappedObjects:[...new Set(guidance.filter(g=>g.mapping.status==='unmapped').map(g=>g.objectId))]}};
    },
    async assertCurrent(packet){if(packet.fingerprint!==fingerprint(new Set([...bundle.revocations,...await revocations()])))throw Error('GUIDANCE_EVIDENCE_CHANGED');},
  };
}
const processMatches=(rule:string,variant:Variant)=>{
  const text=variant.steps.join('\n');
  // Require positive action wording; names, alternate methods and “不要油炸” are not events.
  const positive=text.split(/[。；\n]/).filter(s=>!/(?:不要|不宜|不能|禁止|避免|不需)[^。；\n]{0,8}(?:蒸|煮|炸|煎)/.test(s)).join('\n');
  const fried=/油炸至|炸至|下油锅|煎至|煎炸/.test(positive);
  if(rule==='steam-boil-primary')return /放入蒸锅|上锅蒸|蒸至|蒸熟|煮至|煮熟|汆熟|汆煮|沸水汆/.test(positive)&&!fried;
  if(rule==='fry-primary')return fried;
  if(rule==='blanch-discard-primary')return /焯水|汆|煮/.test(text)&&/弃汤|倒掉.*水|倒掉.*汤|沥干/.test(text);
  return false;
};
export function bindRecipeGuidance(packet:FoodGuidancePacket,content:ContentContext,recipe:Recipe,variant:Variant,omitted:string[]=[]):RecipeGuidanceBinding{
  const matches=packet.guidance.filter(g=>g.applicability==='applicable').flatMap(g=>{
    const lineIndexes=variant.lines.flatMap((line,i)=>g.mapping.foodIds.includes(line.foodId)&&!omitted.includes(content.foodById.get(line.foodId)?.name??'')?[i]:[]);
    const process=g.mapping.processRule&&processMatches(g.mapping.processRule,variant);
    return lineIndexes.length||process?[{guidanceId:g.id,direction:g.direction,foodIds:[...new Set(lineIndexes.map(i=>variant.lines[i].foodId))],lineIndexes,...(process?{processRule:g.mapping.processRule}:{})}]:[];
  });
  return {contentVersion:content.contentVersion,recipeId:recipe.id,recipeVersion:recipe.version,variantId:variant.id,methodId:'primary',recipeHash:guidanceHash({version:recipe.version,variant}),methodHash:guidanceHash(variant.steps),guidanceFingerprint:packet.fingerprint,matches};
}
export function guidanceReason(packet:FoodGuidancePacket,binding:RecipeGuidanceBinding,ids:string[]){
  if(ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!binding.matches.some(m=>m.guidanceId===id)||!packet.guidance.some(g=>g.id===id&&g.applicability==='applicable')))throw Error('GUIDANCE_REASON_INVALID');
  if(binding.matches.some(m=>m.direction==='avoid'))throw Error('GUIDANCE_AVOIDED_RECIPE');
  return ids.map(id=>{const g=packet.guidance.find(g=>g.id===id)!;return `${g.topic.inputName}：${g.direction==='prefer'?'可优先选择':g.direction==='limit'?'含建议少选项':'避开'}${g.objectName}（定性依据，不代表整菜达标）。`;}).join('');
}
