import type { GuidanceEvidence } from './food-guidance';

export interface NutritionSource {
  id:string; title:string; publisher:string; url:string; version:string; reviewedDate:string;
  reviewDue:boolean; acquisition:'official_csv_archive'|'html_visible_text'|'web_tool_rendered_excerpt';
  cacheFile:string; license:string; reuseNote:string; sourceHash:string; retrievedDate:string; status:'active';
}
export interface NutritionTopic {id:string;name:string;kind:'condition'|'goal';aliases:string[]}
export interface NutritionObject {id:string;name:string;kind:'food'|'food_group';names:string[]}
export interface NutritionRule {
  id:string;topicId:string;statement:string;conditions:{key:string;values:string[]}[];
  evidenceIds:string[];qualifyingEvidenceIds:string[];clinicalReview:'pending';
}
export interface NutritionGuidanceFact extends NutritionRule {
  objectId:string;direction:'prefer'|'limit'|'avoid';basis:'source_statement';
}
export interface NutritionPrinciple extends NutritionRule {metricIds:string[]}
export interface CompositionFood {
  id:string;fdcId:string;ndbNumber:string;name:string;aliases:string[];form:string;sourceDescription:string;
  sourceId:string;publicationDate:string;basis:{amount:100;unit:'g';portion:'edible_portion'};
  scope:'US_SR_Legacy_reference_not_Chinese_food_measurement';
}
export interface CompositionNutrient {
  id:string;usdaId:string;name:string;aliases:string[];kind:'energy'|'macronutrient'|'vitamin'|'mineral'|'other';
  unit:'KCAL'|'G'|'MG'|'UG';sourceName:string|null;
}
export interface CompositionValue {
  id:string;foodId:string;nutrientId:string;value:number|null;amountText:string|null;
  unit:CompositionNutrient['unit'];status:'source_reported'|'not_reported';
  sourceRow:Record<string,string>|null;csvRow:number|null;rowHash:string|null;
  derivation:{id:string;code:string;description:string;source_id:string}|null;
}
export interface NutritionExpansion {
  schemaVersion:'1.0.0';id:string;status:'local_research';clinicalRelease:null;professionalReview:'pending';createdDate:string;
  sources:NutritionSource[];evidence:GuidanceEvidence[];topics:NutritionTopic[];objects:NutritionObject[];
  facts:NutritionGuidanceFact[];principles:NutritionPrinciple[];foods:CompositionFood[];nutrients:CompositionNutrient[];
  values:CompositionValue[];
  boundaries:{personalDataIncluded:false;newEmbeddingBuilt:false;onlineEnabled:false;personalEnergyPrescription:false;recipeNutritionCalculated:false};
  exclusions:({url:string;reason:string}|{topic:string;reason:string}|{nutrient:string;reason:string})[];
}
