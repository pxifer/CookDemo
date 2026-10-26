import { createHash } from 'node:crypto';
import type { CompositionApproval, ContentSnapshot } from '../shared/content';
import type { Recipe, Variant } from '../shared/types';
import reviewV2 from '../docs/data/composition-review-v2.json';
import sourceReviewV5 from '../docs/data/composition-source-review-v5.json';
import sourceLineReviewV6 from '../docs/data/composition-source-line-review-v6a.json';
import { verifiedIngredientIdentities } from '../shared/ingredient-evidence';

const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const compositionHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export const COMPOSITION_RELEASE = 'composition-review-20261025-v10';
export const COMPOSITION_BASE_HASH = 'a8672d832d83d0e77fcd331334612a5a3697e89b301d2c49183cd0f830b1063b';
// Each entry was checked against the fixed-commit original's ingredient list,
// calculation and ALL steps. This is a recipe composition check, not medical
// approval, a product-label certificate, nutrition evidence or cross-contact QA.
const firstDefinitions = [
  { reviewId: 'composition-r382-v1', recipeId: 'gallery-219f834a020d8a1e', variantId: 'gallery-219f834a020d8a1e-r382',
    fingerprint: '338ab6c03169dd93120ff44d21a10f91f9df80595f89b690e4537146bd619235', sourceRecord: 'R382',
    sourceSha256: '00708225f67ba4aa10a61b7ea3885487f63bc0b9d4e6d01afa57325bb05d495f',
    leaves: [{ foodId: 'gallery-food-1d740e0aaa9de330', equivalentIds: [] as string[], evidence: '原方必备原料、计算和步骤1–7：仅南瓜入盘；饮用水1000ml用于蒸锅，不作为投料。' }],
    sourceCoverage: '南瓜300g；洗净去瓤籽、切片、摆盘、蒸15–20分钟；未添加油盐或复合调料。' },
  { reviewId: 'composition-r380-v1', recipeId: 'gallery-7883a9dc2be771ba', variantId: 'gallery-7883a9dc2be771ba-r380',
    fingerprint: '8005e35296ac8c0a319d3354e218c6e7bc04bec90243aacfa323004405ecbdfb', sourceRecord: 'R380',
    sourceSha256: '0a17cd82ca74f182fdd543842535beac063179b47bfdf55135f76b8a1101f822',
    leaves: [
      { foodId: 'tomato', equivalentIds: [] as string[], evidence: '必备原料、计算：西红柿2个共约200g，步骤1–5去皮切块摆盘。' },
      { foodId: 'gallery-food-4f7a2bfbb8b66631', equivalentIds: ['sugar'], evidence: '计算：白砂糖20g；步骤6称白糖，指向同一配料，不是另加一种糖。' },
      { foodId: 'sugar', equivalentIds: ['gallery-food-4f7a2bfbb8b66631'], evidence: '步骤6白糖对应计算栏白砂糖；仅在本配方内双向核对。' },
      { foodId: 'gallery-food-900b6de53f9a9c3e', equivalentIds: [] as string[], evidence: '步骤2：开水冲30秒为去皮替代操作；保留已解析行并参与限制检查。' },
    ], sourceCoverage: '原方仅西红柿、白砂糖；步骤开水去皮、撒白糖、冷藏10分钟均核对，无油或复合调料。' },
] as const;
export interface Definition {reviewId:string;recipeId:string;variantId:string;fingerprint:string;sourceRecord:string;sourceSha256:string;sourceUri?:string;sourceCoverage:string;leaves:readonly {foodId:string;equivalentIds:readonly string[];evidence:string;verified?:boolean}[]}
const baseDefinitions:readonly Definition[]=[...firstDefinitions,...reviewV2.definitions,...sourceReviewV5.definitions];
const lineApprovals=sourceLineReviewV6.approvals as {reviewId:string;recipeId:string;variantId:string;foodId:string;sourceRecord:string;sourceSha256:string;sourceLines:string[];identityId:string;identityEvidence:string;evidence:string}[];
const lineApprovalMap=new Map(lineApprovals.map(approval=>[`${approval.recipeId}\0${approval.variantId}\0${approval.foodId}`,approval]));
if(lineApprovalMap.size!==lineApprovals.length||sourceLineReviewV6.productLabelsInferred!==0)throw Error('SOURCE_LINE_REVIEW_INVALID');
export const reviewedDefinitions:readonly Definition[]=baseDefinitions.map(definition=>({...definition,leaves:definition.leaves.map(leaf=>{
  const approval=lineApprovalMap.get(`${definition.recipeId}\0${definition.variantId}\0${leaf.foodId}`);
  if(!approval)return leaf;
  if(leaf.verified!==false||approval.reviewId!==definition.reviewId||approval.sourceRecord!==definition.sourceRecord
    ||approval.sourceSha256!==definition.sourceSha256||!approval.identityEvidence||!approval.evidence)throw Error('SOURCE_LINE_APPROVAL_MISMATCH');
  lineApprovalMap.delete(`${definition.recipeId}\0${definition.variantId}\0${leaf.foodId}`);
  return {...leaf,verified:true,evidence:approval.evidence};
})}));
if(lineApprovalMap.size!==0)throw Error('SOURCE_LINE_APPROVAL_ORPHAN');
export function reviewSnapshot(original:ContentSnapshot):ContentSnapshot {
  const snapshot=structuredClone(original);
  snapshot.verifiedIngredientIdentities=verifiedIngredientIdentities(snapshot);
  for(const correction of reviewV2.corrections as any[]){
    const recipe=snapshot.recipes.find(r=>r.id===correction.recipeId),variant=recipe?.variants.find(v=>v.id===correction.variantId);
    if(!recipe||!variant||compositionFingerprint(recipe,variant,snapshot)!==correction.baseFingerprint)throw Error('COMPOSITION_CORRECTION_MISMATCH');
    for(const line of variant.lines)if(correction.optionalFoodIds.includes(line.foodId))line.optional=true;
    variant.lines.push(...correction.addLines);if(correction.appendSteps)variant.steps.push(...correction.appendSteps);
    variant.ingredientNotes=[...(variant.ingredientNotes??[]),...correction.addLines.map((line:any)=>line.sourceText)];
  }
  snapshot.relations=[...(snapshot.relations??[]),...(reviewV2.relations as any[]).map(({foodId,relatedFoodId,kind})=>({foodId,relatedFoodId,kind}))];
  snapshot.unresolvedComponents=(reviewV2.unresolvedComponents as any[]).map(record=>record.foodId);
  // Unknown product sources are target-specific. Generic starch/oil can be
  // relevant to corn/peanut/soy restrictions, but they are not fish ingredients.
  const targetId=(name:string)=>snapshot.foods.find(food=>food.name===name)?.id;
  const corn=targetId('玉米'),peanut=targetId('花生'),soy=targetId('豆腐');
  const starchTargets=[corn].filter((id):id is string=>Boolean(id));
  const oilTargets=[corn,peanut,soy].filter((id):id is string=>Boolean(id));
  snapshot.uncertainComponents=(reviewV2.unresolvedComponents as any[]).flatMap(record=>{
    const targets=/淀粉|生粉/.test(snapshot.foods.find(food=>food.id===record.foodId)?.name??'')?starchTargets:
      /油/.test(snapshot.foods.find(food=>food.id===record.foodId)?.name??'')?oilTargets:[];
    return targets.length?[{foodId:record.foodId,targetIds:targets,evidence:record.evidence}]:[];
  });
  return snapshot;
}
export function compositionFingerprint(recipe: Recipe, variant: Variant, snapshot: ContentSnapshot, equivalents: readonly string[] = []) {
  const ids = new Set([...variant.lines.map(line => line.foodId), ...equivalents]);
  return compositionHash({ id: recipe.id, name: recipe.name, source: recipe.source, variant,
    foods: [...ids].sort().map(id => snapshot.foods.find(food => food.id === id) ?? null),
    relations: (snapshot.relations ?? []).filter(relation => ids.has(relation.foodId) || ids.has(relation.relatedFoodId)),
    unresolvedComponents:snapshot.unresolvedComponents?.some(id=>ids.has(id))?snapshot.unresolvedComponents.filter(id=>ids.has(id)):undefined,
  });
}
function matches(definition: Definition, recipe: Recipe, variant: Variant, snapshot: ContentSnapshot) {
  return recipe.id === definition.recipeId && variant.id === definition.variantId
    && (!definition.sourceUri || recipe.source.uri === definition.sourceUri)
    && new Set(variant.lines.map(line=>line.foodId)).size === definition.leaves.length
    && variant.lines.every(line => definition.leaves.some(leaf => leaf.foodId === line.foodId))
    && compositionFingerprint(recipe, variant, snapshot, definition.leaves.flatMap(leaf => [...leaf.equivalentIds])) === definition.fingerprint;
}
export interface CompositionRelease {
  kind: 'recipe-composition-review'; baseRelease: 'gallery-preview-20261023'; baseHash: string;
  records: { recipeId: string; variantId: string; state: 'verified-composition' | 'source-covered-with-unresolved' | 'pending-source-review'; approval?: CompositionApproval; evidence?: unknown; reason?: string }[];
  ingredientFacts?:unknown;
}
function buildReviewedRelease(snapshot: ContentSnapshot): CompositionRelease {
  return { kind: 'recipe-composition-review', baseRelease: 'gallery-preview-20261023', baseHash: COMPOSITION_BASE_HASH,
    ingredientFacts:{relations:reviewV2.relations,unresolvedComponents:reviewV2.unresolvedComponents,corrections:reviewV2.corrections,
      verifiedIngredientIdentities:snapshot.verifiedIngredientIdentities},
    records: snapshot.recipes.flatMap(recipe => recipe.variants.map(variant => {
      const definition = reviewedDefinitions.find(definition => matches(definition, recipe, variant, snapshot));
      return definition ? { recipeId: recipe.id, variantId: variant.id, state: definition.leaves.some(leaf=>leaf.verified===false)?'source-covered-with-unresolved' as const:'verified-composition' as const,
        approval: { reviewId: definition.reviewId, recipeId: recipe.id, variantId: variant.id, fingerprint: definition.fingerprint },
        evidence: { ...definition, sourceUri: recipe.source.uri, checkedAt: '2026-10-24', scope: 'recipe-composition-only', nutritionImported: false, crossContactVerified: false } }
        : { recipeId: recipe.id, variantId: variant.id, state: 'pending-source-review' as const,
          reason: recipe.source.kind === 'local-candidate' ? '原方覆盖或食材/复合调料成分证据尚未逐项核齐，维持原限制拦截。' : '沿用既有来源准入；本批次未新增成分审核结论。' };
    })) };
}
export function buildCompositionRelease(snapshot:ContentSnapshot){return buildReviewedRelease(reviewSnapshot(snapshot));}
export function applyCompositionRelease(snapshot: ContentSnapshot, release: CompositionRelease, expectedHash: string) {
  const reviewed=reviewSnapshot(snapshot),expected = buildReviewedRelease(reviewed);
  if (compositionHash(release) !== expectedHash || compositionHash(release) !== compositionHash(expected)
    || expected.records.filter(record => record.approval).length !== reviewedDefinitions.length) throw Error('COMPOSITION_RELEASE_INVALID');
  return { ...reviewed, contentVersion: `${snapshot.contentVersion}-composition-${expectedHash.slice(0, 12)}`,
    compositionApprovals: release.records.flatMap(record => record.approval ? [record.approval] : []) };
}
// Recheck the current graph on every recommendation, swap, variant and favorite
// validation. A flag supplied by a client or an unbound DB row cannot grant access.
export function verifiedComposition(recipe: Recipe, variant: Variant, snapshot: ContentSnapshot) {
  return reviewedDefinitions.find(definition => snapshot.compositionApprovals?.some(approval => approval.reviewId === definition.reviewId
    && approval.recipeId === recipe.id && approval.variantId === variant.id && approval.fingerprint === definition.fingerprint)
    && matches(definition, recipe, variant, snapshot));
}
