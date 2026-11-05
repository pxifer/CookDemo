import {readFile} from 'node:fs/promises';
import {verifyGalleryBundle} from '../backend/src/cloudbase-content';
import {contentContext} from '../shared/content';
import {defaultMeal} from '../shared/types';
import {inputIngredient} from '../frontend/src/meal-input';
import {recommend} from '../backend/src/recommendation';
const root='.local-data/cloudbase-http/listed-foods-20261026-v27';
const bundle=JSON.parse(await readFile(`${root}/gallery-bundle.json`,'utf8')),manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const context=contentContext(verifyGalleryBundle(bundle,manifest.hash));
const meal={...defaultMeal(),allowBuy:true,mode:'candidates' as const,ingredients:['猪肉','白菜','粉条','鸡蛋','土豆','牛肉'].map(n=>inputIngredient(n,context))};
const result=[];let cursor:string|undefined;
for(const page of [0,1,0,1,0]){const before=performance.now();const r=await recommend(context.recipes,{operationId:crypto.randomUUID(),meal,action:cursor?'page':'generate',page,selected:[],previous:[],cursor},{context});cursor=r.cursor;result.push({page,totalMs:Math.round(performance.now()-before),calculationMs:r.elapsedMs});}
console.log(JSON.stringify(result));
