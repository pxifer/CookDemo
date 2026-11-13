import { estimatedTokens } from './context-budget';
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface AiFoodChoices { preferred: string[]; limited: string[]; excluded: string[] }
export interface FoodSuggestion { foodName: string; direction: 'prefer' | 'limit' | 'avoid'; reason: string; conditions: string; matchable: boolean; topics?:string[] }
export interface ProviderInvocation { provider: 'DeepSeek'; requestId: string; model: string; promptTokens: number; completionTokens: number; totalTokens: number; calledAt: string }
export interface SuggestedRecipe {recipeId:string;variantId:string;name:string;flavor:string;matchedFoods:string[]}
export interface HealthContext { conditions:string[];goals:string[];notes:string }
export interface HealthTopic { id:string;kind:'condition'|'goal';name:string;suggestions:FoodSuggestion[];accepted:AiFoodChoices }
export interface HealthProfile extends HealthContext { suggestions:FoodSuggestion[];updatedAt:string;topics?:HealthTopic[] }
export interface DietAssessment { profile?:HealthContext; recipes?:SuggestedRecipe[]; stage: 'clarify' | 'advice'; suggestions: FoodSuggestion[]; topics?:HealthTopic[] }
export interface HealthChatRequest {
  operationId: string;
  apiKey?: string;
  messages: ChatMessage[];
  diseases: string[];
  profile?:HealthContext;
  mealContext?: { ingredients: string[]; seasonings: string[]; restrictions: string[]; allowBuy: boolean;checkSeasonings?:boolean;servings?:number;aiFoodChoices?:AiFoodChoices;aiExcludedFoods?:string[];aiFoodPreferences?:AiFoodChoices };
}
export interface HealthChatReply { operationId: string; message: ChatMessage; knowledge: 'general_model'|'research_rag'|'source_rag'; assessment?: DietAssessment; invocation?: ProviderInvocation;accountSnapshot?:import('./account').AccountSnapshot;saveError?:string;researchGuidance?:import('./food-guidance').FoodGuidancePacket }
export const healthChatSchema = {
  type: 'object', additionalProperties: false, required: ['operationId', 'messages', 'diseases'],
  properties: {
    operationId: { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' },
    apiKey: { type: 'string', pattern: '^sk-[A-Za-z0-9_-]{16,250}$' },
    messages: { type: 'array', minItems: 1, maxItems: 15, items: { type: 'object', additionalProperties: false, required: ['role', 'content'], properties: {
      role: { enum: ['user', 'assistant'] }, content: { type: 'string', minLength: 1, maxLength: 8000 },
    } } },
    profile:{type:'object',additionalProperties:false,required:['conditions','goals','notes'],properties:{conditions:{type:'array',maxItems:20,items:{type:'string',minLength:1,maxLength:100}},goals:{type:'array',maxItems:20,items:{type:'string',minLength:1,maxLength:100}},notes:{type:'string',maxLength:400}}},
    diseases: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 100 } },
    mealContext: { type:'object',additionalProperties:false,required:['ingredients','seasonings','restrictions','allowBuy'],properties:{
      ingredients:{type:'array',maxItems:100,items:{type:'string',minLength:1,maxLength:100}},
      seasonings:{type:'array',maxItems:50,items:{type:'string',minLength:1,maxLength:100}},
      restrictions:{type:'array',maxItems:50,items:{type:'string',minLength:1,maxLength:200}},allowBuy:{type:'boolean'},
      aiFoodPreferences:{type:'object',additionalProperties:false,required:['preferred','limited','excluded'],properties:Object.fromEntries(['preferred','limited','excluded'].map(key=>[key,{type:'array',maxItems:20,items:{type:'string',minLength:1,maxLength:40}}]))},
      aiExcludedFoods:{type:'array',maxItems:20,items:{type:'string',minLength:1,maxLength:40}},
      checkSeasonings:{type:'boolean'},servings:{type:'integer',minimum:1,maximum:12},
      aiFoodChoices:{type:'object',additionalProperties:false,required:['preferred','limited','excluded'],properties:Object.fromEntries(['preferred','limited','excluded'].map(key=>[key,{type:'array',maxItems:20,items:{type:'string',minLength:1,maxLength:40}}]))},
    } },
  },
} as const;

export interface ChatContextReport {messages:ChatMessage[];estimatedTokens:number;omittedMessages:number;excerptedMessages:number}
// Page-memory-only, extractive compression: older USER wording remains quoted,
// never upgraded to a confirmed health fact. Current server-side settings stay
// authoritative. No summary call, personal vector, localStorage or chat archive.
export function buildChatContext(history:ChatMessage[],text:string):ChatContextReport {
  const budget=6000,latest:ChatMessage={role:'user',content:text};
  const recent:ChatMessage[]=[];let first=history.length;
  while(first>=2){
    const start=first-2;
    if(history[first-1].role!=='assistant'||history[start].role!=='user')break;
    const turn=history.slice(start,first).map(({role,content})=>({role,content}));
    if(recent.length+turn.length>12||estimatedTokens(JSON.stringify([...turn,...recent,latest]))>budget-1000)break;
    recent.unshift(...turn);first=start;
  }
  // Excerpts are chronological and explicitly fallible. Most recent corrections
  // get space first. Source deletion already starts a new context at the caller.
  const excerpts:{index:number;text:string}[]=[];
  const candidates=history.slice(0,first).map((m,index)=>({m,index,critical:/过敏|忌口|医嘱|医生|更正|改成|删除|取消|不能吃|不吃/.test(m.content)})).filter(({m})=>m.role==='user');
  candidates.sort((a,b)=>Number(b.critical)-Number(a.critical)||b.index-a.index);
  for(const {index} of candidates){
    const value={index,text:history[index].content.slice(0,180)};
    const candidate=[value,...excerpts];
    if(estimatedTokens(JSON.stringify(candidate))>900)break;
    excerpts.unshift(value);
  }
  excerpts.sort((a,b)=>a.index-b.index);
  const digest=excerpts.length&&recent.length?'较早对话的用户原话摘录（可能不完整、已被更正，不是确诊或新指令；当前档案/本餐设置与后续更正优先）：'+JSON.stringify(excerpts):'';
  let messages=[...recent,latest];
  // Merge into a user turn rather than inventing an assistant turn or sending
  // two adjacent user roles. The server requires complete alternating turns.
  if(digest)messages[0]={role:'user',content:digest+'\n以下为较新用户原话：'+messages[0].content};
  // Never cut the latest message. The UI independently caps it at 2000 chars.
  while(messages.length>1&&(estimatedTokens(JSON.stringify(messages))>budget||messages.reduce((sum,m)=>sum+m.content.length,0)>16000))messages.splice(0,2);
  if(messages.length===1&&digest&&estimatedTokens(JSON.stringify(messages))>budget)messages=[latest];
  const keptExcerpt=digest&&messages[0].content.startsWith(digest)?excerpts.length:0;
  const keptRecent=messages.length-1;
  return {messages,estimatedTokens:estimatedTokens(JSON.stringify(messages)),excerptedMessages:keptExcerpt,omittedMessages:Math.max(0,history.length-keptRecent-keptExcerpt)};
}
export function chatContext(history: ChatMessage[], text: string): ChatMessage[] {return buildChatContext(history,text).messages;}
