import { readFile } from 'node:fs/promises';
import { galleryContent, type CandidateRow } from '../backend/src/gallery-content';
import { compositionFingerprint, reviewSnapshot } from '../backend/src/composition-review';
import { contentContext, type ContentSnapshot } from '../shared/content';
import compositionV2 from '../datasets/recipes/curation/composition-review-v2.json';
import { defaultMeal } from '../shared/types';
import { checkDish } from '../backend/src/recommendation';
import { verifiedIngredientIdentities } from '../shared/ingredient-evidence';
import { createHash } from 'node:crypto';
const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

const bundle = JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json', 'utf8')) as {
  base: ContentSnapshot; rows: CandidateRow[];
};
const drafts = (await readFile('datasets/recipes/curation/recipe-original-drafts-2026-10-26.jsonl', 'utf8'))
  .trim().split(/\r?\n/).map(line => JSON.parse(line));
const sourceCards = (await readFile('datasets/recipes/curation/recipe-cards-v3.jsonl', 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
const rows: CandidateRow[] = drafts.map(({ recipe }) => ({
  dish_key: recipe.name, flavor: recipe.flavor, source_uri: recipe.url, image_url: null,
  raw_record: { ...recipe, source: 'shiwei-original-draft', license: 'Original recipe authored for Shiwei',
    author: '拾味原创配方（文字核验通过，未试做）' },
}));
const originalNames = new Set(rows.map(row => row.dish_key));
if (rows.length !== 2 || originalNames.size !== 2 || rows.some(row => !row.source_uri.startsWith('urn:shiwei:recipe-expansion:2026-10-26:'))) {
  throw new Error('ORIGINAL_RECIPE_SOURCE_INVALID');
}
const activeRows = process.argv.includes('--base-only') ? bundle.rows : [...bundle.rows, ...rows];
const snapshot = galleryContent(bundle.base, activeRows);
if (process.argv.includes('--verify-only')) {
  snapshot.verifiedIngredientIdentities = verifiedIngredientIdentities(snapshot);
  const context = contentContext(snapshot);
  const results = snapshot.recipes.filter(recipe => originalNames.has(recipe.name)).map(recipe => {
    const variant = recipe.variants[0];
    return { name: recipe.name,
      lines: variant.lines.map(line => ({ foodId: line.foodId, name: context.foodById.get(line.foodId)?.name })),
      restrictions: ['猪肉', '鱼', '玉米'].map(name => {
        const meal = { ...defaultMeal(), allowBuy: true,
          restrictions: [{ id: name, kind: 'avoid' as const, name,
            targets: context.restrictionTargets(name), status: 'confirmed' as const, scope: 'self' as const, original: name }] };
        return { name, targets: meal.restrictions[0].targets,
          blocked: !checkDish(recipe, variant, meal, context).dish };
      }) };
  });
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}
if (process.argv.includes('--diagnose')) {
  console.log(JSON.stringify((compositionV2.corrections as any[]).map(correction => {
    const recipe = snapshot.recipes.find(item => item.id === correction.recipeId);
    const variant = recipe?.variants.find(item => item.id === correction.variantId);
    const definition = (compositionV2.definitions as any[]).find(item => item.recipeId === correction.recipeId);
    const sourceRow = bundle.rows.find(row => row.raw_record.id === definition?.sourceRecord);
    const sourceCard = sourceCards.find(card => card.id === definition?.sourceRecord);
    const sourceMatches: unknown[] = [];
    if (recipe && variant) for (const kind of ['local-candidate', 'community'] as const)
      for (const author of ['HowToCook 社区菜谱', 'HowToCook 社区'] as const)
        for (const license of ['发布许可待核（仅内部候选）', 'The Unlicense'] as const)
          for (const reviewed of [false, true]) {
            const altered = { ...recipe, source: { ...recipe.source, kind, author, license, reviewed } };
            if (compositionFingerprint(altered, variant, snapshot) === correction.baseFingerprint)
              sourceMatches.push({ kind, author, license, reviewed });
          }
    return { recipeId: correction.recipeId, variantId: correction.variantId, recipeFound: !!recipe,
      variantFound: !!variant, expected: correction.baseFingerprint,
      actual: recipe && variant ? compositionFingerprint(recipe, variant, snapshot) : null,
      sourceMetadataOnlyMatch: sourceMatches,
      sourceRecord: definition?.sourceRecord, sourceSha256: definition?.sourceSha256,
      sourceRawSha256: sourceRow ? createHash('sha256').update(canonical(sourceRow.raw_record)).digest('hex') : null,
      currentSourceCardSha256: sourceCard ? createHash('sha256').update(canonical(sourceCard)).digest('hex') : null,
      recipeSource: recipe?.source, lines: variant?.lines, ingredientNotes: variant?.ingredientNotes };
  }), null, 2));
  process.exit(0);
}
const reviewed = reviewSnapshot(snapshot);
const records = rows.map(row => {
  const recipe = reviewed.recipes.find(item => item.name === row.dish_key)!;
  const variant = recipe.variants.find(item => item.id.endsWith(`-${row.raw_record.id.toLowerCase()}`))!;
  return { recipeId: recipe.id, name: recipe.name, variantId: variant.id,
    fingerprint: compositionFingerprint(recipe, variant, reviewed), sourceRecord: row.raw_record.id,
    sourceUri: row.source_uri,
    leaves: variant.lines.map(line => ({ foodId: line.foodId, foodName: reviewed.foods.find(food => food.id === line.foodId)?.name,
      evidence: `${recipe.name}自编配方：配料栏与做法逐项对应，未使用未列明复合调味料；仅核验本配方文本，不代表试做或专业营养审核。` })) };
});
console.log(JSON.stringify({ baseRows: bundle.rows.length, candidateRows: process.argv.includes('--base-only') ? 0 : rows.length,
  candidateDishNames: [...originalNames], records }, null, 2));
