import { readFile, writeFile } from 'node:fs/promises';
import { curateCandidate } from './lib/candidate-curation';

const readLines=async(path:string)=>(await readFile(path,'utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line));
const cards=[...(await readLines('docs/data/recipe-cards-v3.jsonl')).filter(card=>card.source==='howtocook'&&card.completeness==='full_process'),...await readLines('docs/data/recipe-candidates-supplement-v1.jsonl')];
const manifest=JSON.parse(await readFile('docs/data/recipe-candidate-images.json','utf8'));
const completed=new Set(manifest.generated.map((item:any)=>cards.find(card=>card.id===item.id)?.dish_key));
const missing=[...new Map(cards.filter(card=>!completed.has(card.dish_key)).map(card=>[card.dish_key,card])).values()];
const prompts=missing.map(card=>{
  const source=curateCandidate(card)?.record??card;
  const name=`${card.id.toLowerCase()}-recipe-finedining-v1.png`;
  return {id:card.id,dish:card.dish_key,name,asset:`public/assets/recipes/${name}`,tool:'built-in image_gen',
    prompt:`Use case: photorealistic-natural. Create ONE single photorealistic restaurant menu food photograph for the Chinese dish ${card.dish_key}. Landscape 4:3. Match the existing elegant Chinese recipe site: fully cooked appetizing realistic food, restrained refined presentation on warm ivory ceramic, quiet beige stone table, warm natural side light, slightly elevated three-quarter view with entire plate or bowl visible. The main dish must faithfully match this actual recipe. Read the ingredients and finishing steps below and depict the completed dish, not a preparation scene. Main ingredients: ${JSON.stringify(source.main??[])}. Auxiliary ingredients: ${JSON.stringify(source.aux??[])}. Seasonings: ${JSON.stringify(source.seasonings??[])}. Cooking steps: ${JSON.stringify(source.steps??[])}. Use a coherent version for optional ingredients or alternative methods, and omit any garnish not in the recipe. No text, watermark, people, utensils, side dishes, raw meat, or collage.`,
    review:'原创生成配图；按现有原方核对主料、切法与成菜形态，不作为试做或来源实拍证明。'};
});
await writeFile('docs/data/recipe-image-prompts-2026-10-25-complete.json',JSON.stringify(prompts,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({count:prompts.length,dishes:prompts.map(({id,dish})=>({id,dish}))}));
