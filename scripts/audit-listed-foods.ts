import {readFile} from 'node:fs/promises';
import {listedIngredients} from './lib/listed-food-curation';
const base=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261023/gallery-bundle.json','utf8'));
const read=async(path:string)=>(await readFile(path,'utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line));
const extra=[...await read('datasets/recipes/curation/recipe-expansion-simple-v1.jsonl'),...await read('datasets/recipes/curation/recipe-original-drafts-2026-10-26.jsonl')];
const cards=process.argv.includes('--new-only')?extra.map(row=>row.recipe):[...base.rows.map((row:any)=>row.raw_record),...extra.map(row=>row.recipe)];
const entries=cards.flatMap((card:any)=>listedIngredients(card));
console.log(JSON.stringify({cards:cards.length,names:[...new Set(entries.map(item=>item.name))].sort(),empty:cards.filter((card:any)=>!listedIngredients(card).some(item=>item.role==='main')).map((card:any)=>({id:card.id,name:card.dish_key,main:card.main}))},null,2));
