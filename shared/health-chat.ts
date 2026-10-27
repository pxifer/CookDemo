export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface AiFoodChoices { preferred: string[]; limited: string[]; excluded: string[] }
export interface FoodSuggestion { foodName: string; direction: 'prefer' | 'limit' | 'avoid'; reason: string; conditions: string; matchable: boolean }
export interface ProviderInvocation { provider: 'DeepSeek'; requestId: string; model: string; promptTokens: number; completionTokens: number; totalTokens: number; calledAt: string }
export interface DietAssessment { stage: 'clarify' | 'advice'; suggestions: FoodSuggestion[] }
export interface HealthChatRequest {
  operationId: string;
  apiKey: string;
  messages: ChatMessage[];
  diseases: string[];
  mealContext?: { ingredients: string[]; seasonings: string[]; restrictions: string[]; allowBuy: boolean;checkSeasonings?:boolean;servings?:number;aiFoodChoices?:AiFoodChoices };
}
export interface HealthChatReply { operationId: string; message: ChatMessage; knowledge: 'general_model'; assessment?: DietAssessment; invocation?: ProviderInvocation }
export const healthChatSchema = {
  type: 'object', additionalProperties: false, required: ['operationId', 'apiKey', 'messages', 'diseases'],
  properties: {
    operationId: { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' },
    apiKey: { type: 'string', pattern: '^sk-[A-Za-z0-9_-]{16,250}$' },
    messages: { type: 'array', minItems: 1, maxItems: 15, items: { type: 'object', additionalProperties: false, required: ['role', 'content'], properties: {
      role: { enum: ['user', 'assistant'] }, content: { type: 'string', minLength: 1, maxLength: 8000 },
    } } },
    diseases: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 100 } },
    mealContext: { type:'object',additionalProperties:false,required:['ingredients','seasonings','restrictions','allowBuy'],properties:{
      ingredients:{type:'array',maxItems:100,items:{type:'string',minLength:1,maxLength:100}},
      seasonings:{type:'array',maxItems:50,items:{type:'string',minLength:1,maxLength:100}},
      restrictions:{type:'array',maxItems:50,items:{type:'string',minLength:1,maxLength:200}},allowBuy:{type:'boolean'},
      checkSeasonings:{type:'boolean'},servings:{type:'integer',minimum:1,maximum:12},
      aiFoodChoices:{type:'object',additionalProperties:false,required:['preferred','limited','excluded'],properties:Object.fromEntries(['preferred','limited','excluded'].map(key=>[key,{type:'array',maxItems:20,items:{type:'string',minLength:1,maxLength:40}}]))},
    } },
  },
} as const;

// Keep complete turns and a bounded transient context; never write this to storage.
export function chatContext(history: ChatMessage[], text: string): ChatMessage[] {
  const context: ChatMessage[] = [...history.slice(-14), { role: 'user', content: text }];
  while (context.length > 1 && context.reduce((sum, message) => sum + message.content.length, 0) > 16000) context.splice(0, 2);
  return context;
}
