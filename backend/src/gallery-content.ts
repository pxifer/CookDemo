import { createHash } from 'node:crypto';
import type { Database } from './db';
import { ContentRepository } from './content-repository';
import { DomainError } from './recommendation';
import { contentContext, type ContentSnapshot } from '../../shared/content';
import type { Food, Line, Recipe } from '../../shared/types';
import { optionalIngredient } from '../../shared/recipe-ingredients';
import { ingredientNames } from '../../shared/candidate-food-names';
import { isAromatic, isCookingWater, isSeasoningFood } from '../../shared/pantry';
import { recipeImage, RECIPE_IMAGE_VERSION } from '../../shared/recipe-images';

const EXPANSION_BATCHES = ['previous','cctv','chef-indexed','bilibili-description','shiwei-original-draft'].map(source=>`recipe-expansion-20261026-${source}-v1`);

export const GALLERY_RELEASE = 'local-business-gallery-v1';
export interface CandidateRow {
  dish_key: string; flavor: string; source_uri: string; image_url: string | null;
  raw_record: { id: string; category: 'meat'|'veg'|'soup'; author?:string; source?:string; license?:string; main?: string[]; aux?: string[]; seasonings?: string[]; steps?: string[];
    foodLevelReviewed?:boolean; ingredients?:{name:string;role:Line['role'];sourceText:string;optional:boolean}[];
    method_options?: { label: string; steps: string[] }[]; review_notes?: string[] };
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function readCandidateRows(database: Database): Promise<CandidateRow[]> {
  try {
    const table = await database.query<{present:boolean}>(`SELECT to_regclass('public.recipe_candidates') IS NOT NULL AND to_regclass('public.recipe_candidate_images') IS NOT NULL AND to_regclass('public.recipe_candidate_reviews') IS NOT NULL AS present`);
    if (!table.rows[0]?.present) throw new DomainError('LOCAL_CANDIDATES_NOT_READY',503,'本地候选库尚未准备');
    const result = await database.query<CandidateRow>(`SELECT c.dish_key,COALESCE(r.curated_record->>'flavor',c.flavor) AS flavor,c.source_uri,
      COALESCE(r.curated_record,c.raw_record) AS raw_record,c.review_state,r.notes AS curation_notes,
      i.image_url,i.reference_image_url,i.review_state AS image_review_state,i.source_uri AS image_source_uri
      FROM recipe_candidates c
      LEFT JOIN recipe_candidate_images i ON i.batch_id=c.batch_id AND i.dish_key=c.dish_key
      LEFT JOIN recipe_candidate_reviews r ON r.batch_id=c.batch_id AND r.source_record_id=c.source_record_id
        AND r.source_sha256=c.raw_sha256 AND r.state='pending_review'
        WHERE c.batch_id=ANY($1::text[]) AND c.review_state='pending_review'
      ORDER BY c.dish_key,c.flavor,c.source_record_id`,[['howtocook-0e106eea348c734fe1586f781202994439cf98a5','howtocook-0e106eea348c734fe1586f781202994439cf98a5-supplement-v1',...EXPANSION_BATCHES]]);
    return result.rows;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('LOCAL_CANDIDATE_DATABASE_UNAVAILABLE',503,'图鉴暂不可用，请稍后重试');
  }
}

// Local testing uses the existing candidate records directly. It never marks them reviewed or writes a public release.
export function galleryContent(base: ContentSnapshot, rows: CandidateRow[]): ContentSnapshot {
  if (!rows.length) throw new DomainError('CONTENT_EMPTY',503,'图鉴没有可用菜谱');
  const foods: Food[] = structuredClone(base.foods);
  const baseContext = contentContext(base), byName = new Map(foods.map(f => [f.name, f]));
  const vocabulary=foods.flatMap(f=>[f.name,...f.aliases]);
  const food = (name: string): Food => {
    const found = baseContext.findFood(name);
    const known = found && base.foods.some(food => food.id === found.id) ? found : byName.get(name);
    if (known) return known;
    const f: Food = { id: `gallery-food-${hash(name).slice(0,16)}`, name, aliases: [], unit: 'g', form: 'raw',
      allergens: [], componentsComplete: false, nutrition: {} };
    foods.push(f); byName.set(name,f); return f;
  };
  const lines = (text: string, role: Line['role']): Line[] => {
    // Quantities/ranges and alternatives stay verbatim. No guessed grams or conversions.
    const names = ingredientNames(text,vocabulary);
    return [...new Set(names)].map(name => {
      const item=food(name);
      // Pantry ingredients listed as recipe auxiliaries (葱姜蒜等) follow the same
      // seasoning-stock policy as when they appear in the source's seasoning section.
      const pantrySeasoning=isSeasoningFood(item);
      const lineRole:Line['role']=isCookingWater(name)||isAromatic(name)||role!=='main'&&pantrySeasoning
        ? 'seasoning' : role==='seasoning' ? 'auxiliary' : role;
      return { foodId: item.id, amount: null, unit: 'g', role: lineRole,
        basis: 'unknown', form: item.form, optional: optionalIngredient(text), sourceText: text };
    });
  };
  const methodFields=(record:CandidateRow['raw_record'])=>{
    const options=record.method_options??[],primary=record.steps?.length?undefined:options[0];
    const start=primary?1:0;
    return {steps:[...(record.steps?.length?record.steps:primary?.steps??[])],...(primary?.label?{methodLabel:primary.label}:{}),
      ...(options.length>start?{methodOptions:options.slice(start).map(method=>({label:method.label,steps:[...method.steps]}))}:{})};
  };
  const groups = new Map<string,CandidateRow[]>();
  for (const row of rows) groups.set(row.dish_key,[...(groups.get(row.dish_key) ?? []),row]);
  const recipes: Recipe[] = [...groups].map(([name, versions]) => {
    const existing = base.recipes.find(r => r.name === name);
    if (existing) {
      const preserved=structuredClone(existing); // Preserve existing IDs, saved favorites and source-checked quantities.
      for(const variant of preserved.variants){
        const row=versions.find(item=>item.flavor===variant.flavor),primary=row?.raw_record.method_options?.[0];
        if(primary&&!variant.methodLabel&&!row?.raw_record.steps?.length&&variant.steps.join('\n')===primary.steps.join('\n'))variant.methodLabel=primary.label;
      }
      return preserved;
    }
    const first = versions[0], id = `gallery-${hash(name).slice(0,16)}`;
    return { id, name, category: first.raw_record.category, homeStyle: true, minutes: null, servings: 1,
      image: first.raw_record.category === 'meat' ? 'meat' : 'veg', ...(versions.find(v => v.image_url)?.image_url ? {imageUrl:versions.find(v => v.image_url)!.image_url!} : {}),
      version: GALLERY_RELEASE, state: 'published', source: {kind:'local-candidate',author:first.raw_record.author??'来源待核',license:first.raw_record.license??'发布许可待核（仅内部候选）',reviewed:false,uri:first.source_uri,recordId:first.raw_record.id},
      variants: versions.filter((v,i) => versions.findIndex(r => r.flavor === v.flavor) === i).map(v => ({
        id:`${id}-${v.raw_record.id.toLowerCase()}`,flavor:v.flavor,
        lines:v.raw_record.ingredients?v.raw_record.ingredients.map(item=>{const f=food(item.name);return {foodId:f.id,amount:null,unit:'g' as const,role:isCookingWater(f.name)||isAromatic(f.name)||isSeasoningFood(f)?'seasoning' as const:item.role,basis:'unknown' as const,form:f.form,optional:item.optional,sourceText:item.sourceText};}):[...(v.raw_record.main??[]).flatMap(t=>lines(t,'main')),...(v.raw_record.aux??[]).flatMap(t=>lines(t,'auxiliary')),...(v.raw_record.seasonings??[]).flatMap(t=>lines(t,'seasoning'))],
        ingredientNotes:[...(v.raw_record.main??[]),...(v.raw_record.aux??[]),...(v.raw_record.seasonings??[])],
        reviewNotes:[...(v.raw_record.foodLevelReviewed?[]:['内部候选配方，来源许可、配料与用量尚待逐项核对。']),...(v.raw_record.review_notes??[])],
        ...methodFields(v.raw_record),
      })) };
  });
  // Existing recipes outside the gallery remain available, and existing favorites never disappear on this switch.
  for (const recipe of base.recipes) if (!recipes.some(r => r.name === recipe.name)) recipes.push(structuredClone(recipe));
  for (const recipe of recipes) recipe.imageUrl = recipeImage(recipe.name, recipe.imageUrl);
  return {contentVersion:`${GALLERY_RELEASE}-${hash({mapping:3,images:RECIPE_IMAGE_VERSION,base:base.contentVersion,rows}).slice(0,16)}`,contentState:'database-candidate',foods,recipes,categories:base.categories,relations:base.relations};
}

export class GalleryContentRepository {
  constructor(private database: Database) {}
  async load(_release: string) {
    const base = await new ContentRepository(this.database).load('local-business-community-v1');
    return galleryContent(base,await readCandidateRows(this.database));
  }
  async assertAvailable(release: string) { await this.load(release); }
}
