import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

type Card = {
  id: string; dish_key: string; name: string; level: string; category: 'meat' | 'veg' | 'soup';
  flavor: string; main?: string[]; aux?: string[]; seasonings?: string[]; steps?: string[];
  author: string; url: string; source: string; completeness: string; [key: string]: unknown;
};
const readLines = async (path: string): Promise<Card[]> => (await readFile(path, 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as Card);
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const sourceFiles = ['docs/data/recipe-cards-v3.jsonl', 'docs/data/recipe-candidates-supplement-v1.jsonl'];
const [sourceCards, supplement] = await Promise.all(sourceFiles.map(readLines));
const cards = [...sourceCards, ...supplement];
const reviewed = JSON.parse(await readFile('docs/data/community-recipe-review-v1.json', 'utf8')) as { selections: { id: string }[] };
const currentNames = new Set([
  ...sourceCards.filter(card => card.source === 'howtocook' && card.completeness === 'full_process').map(card => card.dish_key),
  ...supplement.map(card => card.dish_key),
  ...reviewed.selections.map(selection => sourceCards.find(card => card.id === selection.id)?.dish_key).filter((name): name is string => !!name),
]);
if (currentNames.size !== 145) throw new Error('EXPANSION_BASE_CATALOG_MISMATCH');

const ingredientCount = (card: Card) => {
  const rows = [...(card.main ?? []), ...(card.aux ?? []), ...(card.seasonings ?? [])];
  const names = rows.flatMap(text => text
    .replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]/g, '')
    .split(/[、，,；;\s]+/).map(value => value.trim()).filter(Boolean));
  return new Set(names).size;
};
const method = (card: Card) => {
  const text = `${card.dish_key} ${(card.steps ?? []).join(' ')}`;
  return /凉拌|拍黄瓜|炝拌/.test(text) ? '拌' : /蒸|焗/.test(text) ? '蒸' : /煎|烙/.test(text) ? '煎' :
    /炖|煲|汤|羹/.test(text) ? '炖煮' : /焖|煨/.test(text) ? '焖' : /烤|烧烤/.test(text) ? '烤' : /炒|爆|干煸|干锅/.test(text) ? '炒' : '烧制';
};
const bestByDish = new Map<string, Card[]>();
for (const card of cards.filter(item => item.completeness === 'full_process' && item.dish_key && !currentNames.has(item.dish_key))) {
  bestByDish.set(card.dish_key, [...(bestByDish.get(card.dish_key) ?? []), card]);
}
const ranked = [...bestByDish.entries()].map(([dish, versions]) => {
  const sorted = [...versions].sort((a, b) => ingredientCount(a) - ingredientCount(b) || (b.steps?.length ?? 0) - (a.steps?.length ?? 0));
  return { dish, first: sorted[0], versions: sorted };
}).sort((a, b) => ingredientCount(a.first) - ingredientCount(b.first) ||
  (a.first.category === b.first.category ? 0 : a.first.category === 'meat' ? -1 : 1) || a.dish.localeCompare(b.dish, 'zh-CN'));
if (ranked.length < 200) throw new Error('EXPANSION_SOURCE_COUNT_INSUFFICIENT');
const editorialDrafts: Card[] = [
  { id:'S001',dish_key:'辣椒炒肉片',name:'辣椒炒肉片',level:'C',category:'meat',flavor:'椒香咸鲜',
    main:['猪肉片 200 g','青椒 200 g'],aux:['蒜 2 瓣'],seasonings:['生抽 10 ml','盐 1 g','淀粉 5 g','食用油 15 ml'],
    steps:['猪肉片加生抽、淀粉抓匀，静置10分钟；青椒切片，蒜切片。','热锅下油，先把肉片摊开炒至变色后盛出。','原锅炒香蒜片，放青椒炒至略软。','肉片回锅，加盐炒匀至肉片熟透即可。'],
    method_options:[{label:'同料先煎后炒',steps:['肉片按配料表与生抽、淀粉抓匀。','先将青椒煎到表面微焦后盛出，再将肉片摊开放入锅中煎熟。','蒜片下锅炒香，青椒和肉片回锅，加盐翻匀即可。']}],
    author:'拾味原创候选（未试做）',url:'urn:shiwei:recipe-expansion:2026-10-26:S001',source:'shiwei-original-draft',completeness:'editorial_draft',
    note:'原创家常候选；标准用量为编辑建议，未试做；复合调味料未使用。'},
  { id:'S002',dish_key:'蒜薹肉丝',name:'蒜薹肉丝',level:'C',category:'meat',flavor:'蒜香咸鲜',
    main:['猪里脊 200 g','蒜苔 250 g'],aux:['生姜 5 g'],seasonings:['生抽 10 ml','淀粉 5 g','盐 1 g','食用油 15 ml'],
    steps:['猪里脊切丝，用生抽和淀粉抓匀；蒜苔切段，生姜切丝。','锅烧热后下油，肉丝快速炒至变色后盛出。','姜丝炒香，下蒜苔翻炒至颜色鲜绿、断生。','肉丝回锅，加盐翻匀并确认肉丝熟透后出锅。'],
    method_options:[{label:'同料先焯后炒',steps:['蒜苔切段，在沸水中焯约30秒后沥干。','肉丝按配料表用生抽和淀粉抓匀，炒至熟透后盛出。','姜丝炒香，蒜苔下锅翻炒，肉丝回锅，加盐炒匀。']}],
    author:'拾味原创候选（未试做）',url:'urn:shiwei:recipe-expansion:2026-10-26:S002',source:'shiwei-original-draft',completeness:'editorial_draft',
    note:'原创家常候选；标准用量为编辑建议，未试做；复合调味料未使用。'},
];
const selected = ranked.slice(0, 200);
const rows = selected.flatMap(({ dish, versions }, index) => {
  const byFlavor = new Map<string, Card>();
  for (const version of versions) if (!byFlavor.has(version.flavor)) byFlavor.set(version.flavor, version);
  return [...byFlavor.values()].map(card => ({
    rank: index + 1,
    tier: index < 150 ? 1 : 2,
    dish_key: dish,
    ingredientEntryCount: ingredientCount(card),
    method: method(card),
    source: card.source,
    sourceUri: card.url,
    recipe: card,
  }));
});
const out = 'docs/data/recipe-expansion-simple-v1.jsonl';
await writeFile(out, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
const editorialRows=editorialDrafts.map((recipe,index)=>({rank:index+1,tier:0,dish_key:recipe.dish_key,
  ingredientEntryCount:ingredientCount(recipe),method:method(recipe),source:recipe.source,sourceUri:recipe.url,recipe}));
await writeFile('docs/data/recipe-original-drafts-2026-10-26.jsonl',editorialRows.map(row=>JSON.stringify(row)).join('\n')+'\n');
const stats = {
  status: 'internal-candidate-only',
  note: 'No recipe source or license is upgraded by this selection. Keep original per-card source and pending review state.',
  sourceDataset: 'docs/data/recipe-cards-v3.jsonl + docs/data/recipe-candidates-supplement-v1.jsonl',
  currentCatalogDishes: currentNames.size,
  newUniqueDishes: selected.length,
  recipeVersions: rows.length,
  first150: { dishes: 150, minIngredientEntries: Math.min(...selected.slice(0, 150).map(item => ingredientCount(item.first))),
    maxIngredientEntries: Math.max(...selected.slice(0, 150).map(item => ingredientCount(item.first))), methods: [...new Set(selected.slice(0, 150).map(item => method(item.first)))] },
  next50: { dishes: 50, minEntries: Math.min(...selected.slice(150).map(item => ingredientCount(item.first))), maxEntries: Math.max(...selected.slice(150).map(item => ingredientCount(item.first))) },
  categories: Object.fromEntries(['meat', 'veg', 'soup'].map(category => [category, selected.filter(item => item.first.category === category).length])),
  sources: Object.fromEntries([...new Set(rows.map(row=>row.source))].map(source=>[source,rows.filter(row=>row.source===source).length])),
  ids: [...new Set(rows.map(row => row.recipe.id))].length,
  uniqueDishes: new Set(rows.map(row => row.dish_key)).size,
  hash: sha(rows.map(row => JSON.stringify(row)).join('\n') + '\n'),
};
if (stats.ids !== rows.length || stats.uniqueDishes !== 200 || rows.some(row => !row.recipe.steps?.length || !row.recipe.main?.length)) throw new Error('EXPANSION_PACK_INVALID');
await mkdir('docs/recipes', { recursive: true });
await writeFile('docs/data/recipe-expansion-simple-v1.json', JSON.stringify(stats, null, 2) + '\n');
const table = selected.map((item, index) => `| ${index + 1} | ${item.first.id} | ${item.dish} | ${ingredientCount(item.first)} | ${item.first.category} | ${item.first.source} | ${item.first.url.startsWith('urn:')?'拾味自编草稿':`[原文](${item.first.url})`} |`).join('\n');
const report = `# 家常少配料菜谱扩展候选 v1\n\n` +
  `本批在当前145道菜之外，按原始配料条目数从少到多挑选200道完整流程：第1～150道为第一批，第151～200道为扩展储备。` +
  `保留各条原始来源、做法、未知用量和待核状态；相同菜名的不同口味只保留不同口味版本，不把同味重复来源当成新菜。` +
  `这份清单用于内部候选库逐方审核，不表示取得来源再发布许可，不改变成分核验、过敏/忌口拦截或正式上线状态。另有两道用户举例的自编短配方候选（辣椒炒肉片、蒜薹肉丝），各含另一种同料做法，未试做并单独存档。\n\n` +
  `生成数据： [JSONL](../data/recipe-expansion-simple-v1.jsonl) · [盘点](../data/recipe-expansion-simple-v1.json)。` +
  ` 自编候选： [单独数据文件](../data/recipe-original-drafts-2026-10-26.jsonl)。当前线上菜谱照片仍是原145道；本批不借用其他菜品图片。\n\n` +
  `| 顺序 | 原方ID | 菜名 | 配料条目 | 分类 | 来源组 | 来源 |\n|---:|---|---|---:|---|---|---|\n${table}\n`;
await writeFile('docs/recipes/expansion-simple-v1.md', report);
console.log(JSON.stringify(stats, null, 2));
