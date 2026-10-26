import { readFile } from 'node:fs/promises';

if(!process.argv.includes('--historical')){
  const manifest=JSON.parse(await readFile('.local-data/cloudbase-http/listed-foods-20261026-v27/manifest.json','utf8'));
  const live=JSON.parse(await readFile('acceptance/listed-foods-v27/live-verification.json','utf8').catch(()=>'{"liveHttp":false}'));
  console.log(JSON.stringify({standard:'D17-02/listed-foods',releaseId:manifest.releaseId,newDishes:manifest.newDishes,recipes:manifest.recipes,
    ingredientRows:manifest.ingredientRows,excluded:manifest.excluded,liveHttpVerified:live.liveHttp,healthEnabled:false,
    historicalAudit:'Use --historical only to inspect the superseded pre-D17-02 gate.'},null,2));
  process.exit(0);
}

type Candidate = {
  rank: number; source: string; sourceUri: string; dish_key: string;
  recipe: { id: string; name: string; author?: string; url?: string; completeness?: string; main?: string[];
    aux?: string[]; seasonings?: string[]; steps?: string[]; method_options?: { label: string; steps: string[] }[]; license?: string };
};
const readLines = async (path: string) => (await readFile(path, 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line) as Candidate);
const expanded = await readLines('docs/data/recipe-expansion-simple-v1.jsonl');
const original = await readLines('docs/data/recipe-original-drafts-2026-10-26.jsonl');
if (expanded.length !== 203 || new Set(expanded.map(row => row.dish_key)).size !== 200 || original.length !== 2) {
  throw new Error('RECIPE_EXPANSION_AUDIT_INPUT_INVALID');
}
const externallySourced = expanded.filter(row => row.source !== 'shiwei-original-draft');
const sourceGroups = Object.fromEntries([...new Set(externallySourced.map(row => row.source))]
  .sort().map(source => [source, externallySourced.filter(row => row.source === source).length]));
const sourceIntegrity = externallySourced.every(row => row.sourceUri && row.recipe.url && row.recipe.author
  && Array.isArray(row.recipe.steps) && row.recipe.steps.length > 0);
const originalChecks = original.map(row => {
  const recipe = row.recipe;
  const entries = [...(recipe.main ?? []), ...(recipe.aux ?? []), ...(recipe.seasonings ?? [])];
  const steps = [...(recipe.steps ?? []), ...(recipe.method_options ?? []).flatMap(method => method.steps)];
  const ingredientTerms = recipe.id === 'S001'
    ? [['猪肉'], ['青椒'], ['蒜'], ['生抽'], ['淀粉'], ['盐'], ['油']]
    : [['猪里脊'], ['蒜苔', '蒜薹'], ['姜'], ['生抽'], ['淀粉'], ['盐'], ['油']];
  const absentTerms = ingredientTerms.filter(terms => !entries.some(entry => terms.some(term => entry.includes(term)))
    || !steps.some(step => terms.some(term => step.includes(term)))).map(terms => terms.join('/'));
  return { id: recipe.id, name: recipe.name, ingredientEntryCount: entries.length,
    steps: recipe.steps?.length ?? 0, alternateMethods: recipe.method_options?.length ?? 0,
    allListedCoreIngredientsUsed: absentTerms.length === 0, absentIngredientTerms: absentTerms,
    amountGaps: entries.filter(entry => /适量|少许|少量|用量未注明/.test(entry)),
    usesCompositeSeasoning: entries.some(entry => /豆瓣酱|复合调味|照烧酱|蚝油.*配料|调料包/.test(entry)),
    trialStatus: 'not cooked or taste-tested', authoringStatus: 'internal original draft' };
});
console.log(JSON.stringify({
  checkedAt: '2026-10-26', externalCandidates: externallySourced.length,
  uniqueExternalDishes: new Set(externallySourced.map(row => row.dish_key)).size, sourceGroups,
  externalSourceRowsComplete: sourceIntegrity,
  externalRecordsWithExplicitLicenseField: externallySourced.filter(row => row.recipe.license).length,
  externalRecordsRightsCleared: 0, externalIngredientCompositionReviewed: 0,
  originalRecipeChecks: originalChecks,
  publishableByThisAudit: 0,
  deploymentPerformed: false,
  reason: 'External records retain source attribution and process text but have no cleared reuse permission; original drafts pass a structural ingredient/step cross-check but remain untried and are not in the approved public content bundle.',
  limitations: ['This is a release-readiness gate, not professional culinary approval.',
    'Source URLs and text completeness do not grant republication rights.',
    'No online data, database, image assets, or release manifests were changed.']
}, null, 2));
