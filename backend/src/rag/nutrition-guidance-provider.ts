import type { FoodGuidance, FoodGuidanceProvider, GuidanceInput, FoodGuidancePacket } from '../../../shared/food-guidance';
import type { HealthContext } from '../../../shared/health-chat';
import type { NutritionExpansion } from '../../../shared/nutrition-knowledge';
import { canonicalKnowledgeHash } from '../health-knowledge';
import { guidanceHash, packetRevocations, reportedConditions } from './food-guidance';
import { nutritionApplicability, nutritionEvidenceBlocked } from './nutrition-knowledge';

export function nutritionProfile(profile:HealthContext,text:string,bundle:NutritionExpansion):HealthContext{
  const result=structuredClone(profile),normalized=text.normalize('NFKC');
  for(const t of bundle.topics)for(const name of [t.name,...t.aliases]){
    const at=normalized.indexOf(name);if(at<0)continue;
    const before=normalized.slice(Math.max(0,at-12),at);
    if(!/我[^。！？?]{0,10}(?:想|希望|目标是|要|有|患有|确诊为|确诊了)$/.test(before)||/没有|不是|未患|如果|假如/.test(before))continue;
    const list=t.kind==='condition'?result.conditions:result.goals;
    if(!list.some(n=>[t.name,...t.aliases].includes(n)))list.push(t.name);
  }
  return result;
}
/** Additive food-level guidance only. Composition values never become dietary actions. */
export function createNutritionGuidanceProvider(base:FoodGuidanceProvider,bundle:NutritionExpansion,revocations:()=>Promise<Set<string>>):FoodGuidanceProvider{
  const contentHash=canonicalKnowledgeHash(bundle);let baseFingerprint:string|undefined;
  const fingerprint=(upstream:string,revoked:Set<string>)=>guidanceHash({upstream,contentHash,revoked:[...revoked].sort()});
  return {
    async prepare(input:GuidanceInput):Promise<FoodGuidancePacket>{
      const profile=nutritionProfile(input.profile,input.currentText??'',bundle);
      const packet=await base.prepare({...input,profile}),revoked=packetRevocations(packet)??await revocations();baseFingerprint=packet.fingerprint;
      const conditions={...reportedConditions(profile.notes,input.currentText),...input.conditions};
      if(conditions.resistanceTraining==='yes'&&!conditions.exerciseTraining)conditions.exerciseTraining='yes';
      if(profile.conditions.length)conditions.healthyExerciser='no';
      const matchedTopics=bundle.topics.filter(t=>(t.kind==='condition'?profile.conditions:profile.goals).some(n=>[t.name,...t.aliases].includes(n)));
      const ids=new Set(matchedTopics.map(t=>t.id));
      for(const t of matchedTopics)if(!packet.topics.some(p=>p.id===t.id))packet.topics.push({id:t.id,kind:t.kind,name:t.name,inputName:(t.kind==='condition'?profile.conditions:profile.goals).find(n=>[t.name,...t.aliases].includes(n))!});
      for(const row of bundle.facts.filter(f=>ids.has(f.topicId))){
        const object=bundle.objects.find(o=>o.id===row.objectId)!,topic=packet.topics.find(t=>t.id===row.topicId)!;
        const foodIds=input.content.foods.filter(f=>!f.id.startsWith('query:')&&object.names.includes(f.name)).map(f=>f.id);
        const missing=row.conditions.filter(c=>!conditions[c.key]||conditions[c.key]==='unknown').map(c=>c.key);
        packet.guidance.push({id:`guide:${row.id}`,factId:row.id,topic,objectId:object.id,objectName:object.name,objectKind:object.kind,direction:row.direction,statement:row.statement,conditions:row.conditions,applicability:nutritionApplicability(bundle,row,conditions,revoked),missingConditions:missing,evidenceIds:row.evidenceIds,qualifyingEvidenceIds:row.qualifyingEvidenceIds,mapping:{foodIds,status:foodIds.length?'mapped':'unmapped'},basis:row.basis,clinicalReview:'pending'} satisfies FoodGuidance);
      }
      packet.nutritionPrinciples=bundle.principles.filter(p=>ids.has(p.topicId)).map(p=>({...p,applicability:nutritionApplicability(bundle,p,conditions,revoked)}));
      const selected=new Set([...packet.guidance,...packet.nutritionPrinciples].filter(g=>g.applicability!=='withdrawn').flatMap(g=>[...g.evidenceIds,...g.qualifyingEvidenceIds]));
      packet.evidence.push(...bundle.evidence.filter(e=>selected.has(e.id)&&!nutritionEvidenceBlocked(bundle,e.id,revoked)&&!packet.evidence.some(p=>p.id===e.id)));
      for(const t of matchedTopics){const key=`${t.kind}:${packet.topics.find(p=>p.id===t.id)!.inputName}`;
        if(packet.guidance.some(g=>g.topic.id===t.id&&g.applicability==='applicable'))packet.uncoveredTopics=packet.uncoveredTopics.filter(k=>k!==key);
        else if(!packet.uncoveredTopics.includes(key))packet.uncoveredTopics.push(key);
      }
      packet.missingConditions=[...new Set([...packet.guidance,...packet.nutritionPrinciples].filter(g=>g.applicability==='needs_confirmation').flatMap(g=>g.conditions.filter(c=>!conditions[c.key]||conditions[c.key]==='unknown').map(c=>c.key)))];
      const applicable=packet.guidance.filter(g=>g.applicability==='applicable');
      packet.conflicts=[...new Set(applicable.map(g=>g.objectId))].flatMap(objectId=>{const rows=applicable.filter(g=>g.objectId===objectId);return rows.some(g=>g.direction==='prefer')&&rows.some(g=>g.direction!=='prefer')?[{objectId,guidanceIds:rows.map(g=>g.id)}]:[];});
      packet.mappingCoverage={total:packet.guidance.length,mapped:packet.guidance.filter(g=>g.mapping.status==='mapped').length,unmappedObjects:[...new Set(packet.guidance.filter(g=>g.mapping.status==='unmapped').map(g=>g.objectId))]};
      packet.knowledgeVersion+=`+${bundle.id}`;packet.fingerprint=fingerprint(baseFingerprint,revoked);
      return packet;
    },
    async assertCurrent(packet,revoked){
      const prepared=packetRevocations(packet),fresh=revoked??await revocations(),union=new Set([...(prepared??[]),...fresh]);
      if(!baseFingerprint||packet.fingerprint!==fingerprint(baseFingerprint,union))throw Error('GUIDANCE_EVIDENCE_CHANGED');
      await base.assertCurrent({fingerprint:baseFingerprint},union);
    },
    ...(base.close?{close:()=>base.close!()}:{}),
  };
}
