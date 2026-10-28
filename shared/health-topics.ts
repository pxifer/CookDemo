import type { AiFoodChoices, DietAssessment, HealthProfile, HealthTopic } from './health-chat';

const empty=():AiFoodChoices=>({preferred:[],limited:[],excluded:[]});
export const topicId=(kind:'condition'|'goal',name:string)=>`${kind}:${name.normalize('NFKC').trim()}`;
export function healthTopics(profile:HealthProfile|undefined,legacy?:AiFoodChoices):HealthTopic[]{
  if(!profile)return [];
  const active=[...profile.conditions.map(name=>({kind:'condition' as const,name})),...profile.goals.map(name=>({kind:'goal' as const,name}))];
  return active.map(({kind,name})=>{
    const id=topicId(kind,name),saved=profile.topics?.find(topic=>topic.id===id);
    // Even a legacy single-condition record may contain suggestions for an already
    // deleted condition. Only explicit provenance is recoverable.
    return saved?structuredClone(saved):{id,kind,name,suggestions:profile.suggestions.filter(item=>item.topics?.includes(id)),accepted:empty()};
  });
}
export function migrateHealthProfile(profile:HealthProfile,legacy?:AiFoodChoices,oldExclusions:string[]=[]):HealthProfile{
  if(profile.topics)return {...profile,topics:healthTopics(profile)};
  const topics=healthTopics(profile);
  // Unscoped old notes may still name removed conditions. Do not send them again.
  return {...profile,notes:'',topics,suggestions:topics.flatMap(topic=>topic.suggestions).slice(-20)};
}
export function combinedTopicChoices(topics:HealthTopic[]):AiFoodChoices{
  const result=empty();
  for(const kind of ['preferred','limited','excluded'] as const)result[kind]=[...new Set(topics.flatMap(topic=>topic.accepted[kind]))];
  result.limited=result.limited.filter(name=>!result.excluded.includes(name));
  result.preferred=result.preferred.filter(name=>!result.excluded.includes(name)&&!result.limited.includes(name));
  return result;
}
export function withHealthTopics(profile:HealthProfile,topics:HealthTopic[]):HealthProfile{
  const suggestions=topics.flatMap(topic=>topic.suggestions.map(item=>({...item,topics:[topic.id]})));
  return {...profile,topics,suggestions:suggestions.slice(-20),updatedAt:new Date().toISOString()};
}
export function removeHealthTopic(profile:HealthProfile,kind:'conditions'|'goals',name:string,legacy?:AiFoodChoices):HealthProfile{
  const id=topicId(kind==='conditions'?'condition':'goal',name);
  return withHealthTopics({...profile,[kind]:profile[kind].filter(item=>item!==name),notes:''},healthTopics(profile,legacy).filter(topic=>topic.id!==id));
}
export function toggleTopicGroup(profile:HealthProfile,legacy:AiFoodChoices|undefined,id:string,kind:keyof AiFoodChoices,names:string[]):HealthProfile{
  const topics=healthTopics(profile,legacy),topic=topics.find(item=>item.id===id);
  if(topic){const all=names.every(name=>topic.accepted[kind].includes(name));topic.accepted[kind]=all?topic.accepted[kind].filter(name=>!names.includes(name)):[...new Set([...topic.accepted[kind],...names])];}
  return withHealthTopics(profile,topics);
}
export function mergeTopicAssessment(previous:HealthProfile|undefined,assessment:DietAssessment):HealthProfile{
  const incoming=assessment.profile??{conditions:[],goals:[],notes:''};
  const unique=(items:string[])=>[...new Set(items)].slice(0,20);
  const next:HealthProfile={conditions:unique([...(previous?.conditions??[]),...incoming.conditions]),goals:unique([...(previous?.goals??[]),...incoming.goals]),notes:incoming.notes||previous?.notes||'',suggestions:[],updatedAt:new Date().toISOString()};
  const old=healthTopics(previous),topics=healthTopics({...next,topics:old});
  const added=topics.filter(topic=>!old.some(item=>item.id===topic.id));
  for(const topic of topics){
    const suggestions=assessment.suggestions.filter(item=>item.topics?.includes(topic.id)||item.topics?.includes(topic.name)||(!item.topics?.length&&(added.length===1?added[0].id===topic.id:topics.length===1)));
    if(suggestions.length)topic.suggestions=suggestions.map(item=>({...item,topics:[topic.id]}));
  }
  return withHealthTopics(next,topics);
}

export function reconcileHealthProfiles(local:HealthProfile,remote:HealthProfile,base:HealthProfile):HealthProfile{
  const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
  const combine=(here:string[],there:string[],before:string[])=>[...new Set([...here,...there])].filter(name=>!before.includes(name)||(here.includes(name)&&there.includes(name))).slice(0,20);
  const profile={...remote,conditions:combine(local.conditions,remote.conditions,base.conditions),goals:combine(local.goals,remote.goals,base.goals)};
  const here=healthTopics(local),there=healthTopics(remote),before=healthTopics(base);
  const topics=healthTopics({...profile,topics:[]}).map(topic=>{
    const l=here.find(item=>item.id===topic.id),r=there.find(item=>item.id===topic.id),b=before.find(item=>item.id===topic.id);
    if(!l)return r??topic;if(!r)return l;
    const accepted=empty();
    for(const kind of ['preferred','limited','excluded'] as const)accepted[kind]=combine(l.accepted[kind],r.accepted[kind],b?.accepted[kind]??[]);
    return {...(same(l,b)?r:l),accepted};
  });
  if(base.conditions.some(name=>!profile.conditions.includes(name))||base.goals.some(name=>!profile.goals.includes(name)))profile.notes='';
  return withHealthTopics(profile,topics);
}
