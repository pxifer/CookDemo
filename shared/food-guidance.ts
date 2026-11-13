import type { HealthContext } from './health-chat';
import type { ContentContext } from './content';
import type { Meal, Variant } from './types';

export type GuidanceDirection = 'prefer' | 'limit' | 'avoid';
export interface GuidanceTopic { id:string; kind:'condition'|'goal'; name:string; inputName:string }
export interface GuidanceTopicCoverage {
  input:string;status:'available'|'missing_conditions'|'not_applicable'|'withdrawn'|'knowledge_gap'|'needs_topic_detail';
  factCount:number;applicableCount:number;missingConditions:string[];
}
export interface GuidanceEvidence {
  id:string; sourceId:string; title:string; version:string; url:string; sourceHash:string;
  originalSpan:string; locator:Record<string,unknown>; spanHash:string;
}
export interface FoodGuidance {
  id:string; factId:string; topic:GuidanceTopic; objectId:string; objectName:string;
  objectKind:'food'|'food_group'|'process'; direction:GuidanceDirection; statement:string;
  conditions:{key:string;values:string[]}[]; applicability:'applicable'|'needs_confirmation'|'not_applicable'|'withdrawn';
  missingConditions:string[]; evidenceIds:string[]; qualifyingEvidenceIds:string[];
  mapping:{foodIds:string[]; processRule?:string; status:'mapped'|'unmapped'};
  basis:'source_statement'|'project_interpretation'; clinicalReview:'pending';
}
export interface FoodGuidancePacket {
  mode:'local_research'|'source_guidance'; clinicalRelease:null; knowledgeVersion:string; fingerprint:string;
  topics:GuidanceTopic[]; guidance:FoodGuidance[]; evidence:GuidanceEvidence[];
  topicCoverage?:GuidanceTopicCoverage[];
  uncoveredTopics:string[]; missingConditions:string[]; conflicts:{objectId:string;guidanceIds:string[]}[];
  mappingCoverage:{total:number;mapped:number;unmappedObjects:string[]};
  nutritionReference?:Record<string,unknown>;
  nutritionPrinciples?:(import('./nutrition-knowledge').NutritionPrinciple&{applicability:FoodGuidance['applicability']})[];
}
export interface GuidanceInput { profile:HealthContext; content:ContentContext; conditions?:Record<string,string>; currentText?:string }
export interface FoodGuidanceProvider {
  prepare(input:GuidanceInput):Promise<FoodGuidancePacket>;
  assertCurrent(packet:Pick<FoodGuidancePacket,'fingerprint'>,revoked?:Set<string>):Promise<void>;
  close?():Promise<void>;
}
export interface RecipeGuidanceBinding {
  contentVersion:string; recipeId:string; recipeVersion:string; variantId:string;
  methodId:'primary'; recipeHash:string; methodHash:string; guidanceFingerprint:string;
  matches:{guidanceId:string;direction:GuidanceDirection;foodIds:string[];lineIndexes:number[];processRule?:string}[];
}
export interface ResearchMealGrounding { mode:'local_research'|'source_guidance'; knowledgeVersion:string;fingerprint:string;coverage?:'matched'|'partial'|'unmatched';uncoveredTopics:string[];missingConditions:string[];clinicalRelease:null }
export interface GuidanceMealInput { meal:Meal;content:ContentContext;packet:FoodGuidancePacket }
export type GuidanceVariant = Variant;
