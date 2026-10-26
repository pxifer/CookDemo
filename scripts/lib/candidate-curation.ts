import { createHash } from 'node:crypto';
const stable=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export const candidateHash=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex');
export type CandidateCard={id:string;flavor:string;main?:string[];aux?:string[];seasonings?:string[];steps?:string[];method_options?:{label:string;steps:string[]}[];[key:string]:unknown};
/** Explicit corrections checked against the fixed source, never inferred ingredients. */
export function curateCandidate(card:CandidateCard){
  const revised=structuredClone(card),notes:string[]=[];
  const requireLine=(kind:'main'|'aux'|'seasonings',line:string)=>{
    if(!revised[kind]?.includes(line))throw new Error('CANDIDATE_CURATION_BASE_MISMATCH');
  };
  const meatCategoryCorrections:Record<string,string>={
    R261:'牛腩 500-600g',R272:'牛腩 500g',
    R321:'牛排 450-500g（两片牛排）',R389:'牛腩 500g',
  };
  if(meatCategoryCorrections[card.id]){
    if(card.category!=='veg')throw new Error('CANDIDATE_CURATION_BASE_MISMATCH');
    requireLine('main',meatCategoryCorrections[card.id]);revised.category='meat';
    notes.push('原方主料明确为牛肉，修正整理阶段误标的素菜分类为荤菜；不改变原料、步骤或原始卡片。');
  }
  if(card.id==='R288'){
    requireLine('aux','切末');requireLine('aux','蒜 4 瓣');requireLine('main','香芹 300 g（约 2 大把）');
    revised.main=['香芹 300 g（约 2 大把）'];revised.aux=['蒜 4 瓣（切末）'];
    notes.push('按固定原文合并同一芹菜的泛称与定量行；“切末”保留为蒜的处理方法，不当成独立食材。');
  }
  if(card.id==='R337'){
    requireLine('aux','马蹄（步骤另提及，未单列固定用量）');requireLine('seasonings','干辣椒 = 5');requireLine('seasonings','6 个');
    revised.aux=revised.aux!.filter(s=>s!=='马蹄（步骤另提及，未单列固定用量）');
    revised.seasonings=revised.seasonings!.filter(s=>s!=='6 个').map(s=>s==='干辣椒 = 5'?'干辣椒 5～6 个':s);
    notes.push('原文“马蹄状”是青椒切法；移除误抽取的马蹄。干辣椒原文“5，6个”合并展示，不增减配料。');
  }
  if(card.id==='R391'){
    if(card.flavor!=='咸鲜')throw new Error('CANDIDATE_CURATION_BASE_MISMATCH');
    revised.flavor='麻酱酸甜';notes.push('按麻酱、陈醋和白糖的原方调味归为“麻酱酸甜”；不改原文用量和步骤。');
  }
  if(card.id==='R315'){
    if(!card.steps?.some(s=>s.includes('使用电压力锅进行烹饪'))||!card.steps.some(s=>s.includes('1100ml')))throw new Error('CANDIDATE_CURATION_BASE_MISMATCH');
    revised.steps=[
      '排骨洗净，切成原方约4cm（±2cm）×3cm（±2cm）的小块。',
      card.steps[1],
      '苦瓜对半切开，去掉籽和瓤，切成原方约0.5cm（±0.3cm）的条，洗净。',
    ];
    const finish='出锅时按原方以盐和白胡椒调味：每250ml汤，盐约0.3～0.6g、白胡椒约0.1～0.5g。';
    revised.method_options=[
      {label:'汤锅',steps:['汤锅放1100ml水和排骨，大火煮沸。','放入苦瓜及虾皮，转小火炖约120～240分钟；原方以肉能较轻松从骨头分离为参考。',finish]},
      {label:'电压力锅',steps:['放1000ml水、排骨、虾皮及苦瓜。','使用炖汤功能；原方一般加压烹饪约45分钟。',finish]},
    ];
    notes.push('恢复固定原文中漏抽的汤锅120～240分钟；汤锅和压力锅分成二选一的同口味工具参考，不串行执行，不表示试做通过。');
  }
  if(card.id==='R345'){
    if(card.steps?.at(-1)!=='--')throw new Error('CANDIDATE_CURATION_BASE_MISMATCH');
    revised.steps=card.steps.slice(0,-1);notes.push('移除被误抽成烹饪步骤的Markdown分隔线；七个原方操作保留。');
  }
  return notes.length?{sourceSha256:candidateHash(card),record:revised,notes,state:'pending_review' as const}:null;
}
