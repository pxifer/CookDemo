import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { foods, categories } from '../../shared/catalog';
import { extraPantryFoods } from '../../shared/pantry';
import type { ContentSnapshot } from '../../shared/content';
import type { Food, Line, Recipe } from '../../shared/types';

export const REVIEWED_RELEASE='local-business-community-v1';
const commit='0e106eea348c734fe1586f781202994439cf98a5';
type Selection={id:string;recipeId:string;minutes:number;servings:number;flavor:string;blobSha:string;cardSha256:string;imageUrl:string;lines:Line[];reviewNotes:string[]};
export async function reviewedContent(release=REVIEWED_RELEASE):Promise<ContentSnapshot>{
  const review=JSON.parse(await readFile('datasets/recipes/curation/community-recipe-review-v1.json','utf8')) as {checkedAt:string;selections:Selection[]};
  const cards=(await readFile('datasets/recipes/curation/recipe-cards-v3.jsonl','utf8')).split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  const allFoods:Food[]=structuredClone([...foods,...extraPantryFoods]);
  // No synthetic nutrient values or third-party calorie estimates enter a reviewed release.
  allFoods.forEach(f=>{f.nutrition={};delete f.nutritionSources;});
  allFoods.find(f=>f.id==='oyster-sauce')!.unit='g';
  const ownFood=(id:string,name:string,unit:Food['unit']='g',allergens:string[]=[],complete=true):Food=>({id,name,unit,allergens,componentsComplete:complete,aliases:[],form:'raw',nutrition:{}});
  allFoods.push(ownFood('winter-melon','冬瓜'),ownFood('cordyceps-flower','虫草花'),ownFood('sesame-paste','芝麻酱','g',['sesame'],false),ownFood('toasted-sesame','熟白芝麻','g',['sesame']),ownFood('water','饮用水','ml'));
  const recipes:Recipe[]=review.selections.map(s=>{
    const card=cards.find(c=>c.id===s.id);
    if(!card||card.source!=='howtocook'||card.commit!==commit||createHash('sha256').update(JSON.stringify(card)).digest('hex')!==s.cardSha256||!/^[a-f0-9]{40}$/.test(s.blobSha))throw Error('REVIEWED_CARD_PROOF_MISMATCH');
    return {id:s.recipeId,name:card.dish_key,category:card.category,homeStyle:true,minutes:s.minutes,servings:s.servings,image:card.category==='meat'?'meat':'veg',imageUrl:s.imageUrl,
      version:release,state:'published',source:{kind:'community',author:'HowToCook 社区',license:'The Unlicense',reviewed:true,reviewBasis:'source-and-structure',uri:card.url,commit,recordId:s.id},
      variants:[{id:`${s.recipeId}-original`,flavor:s.flavor,lines:s.lines,steps:card.steps}]};
  });
  const evidence=(title:string,uri:string,license:string,text:string)=>({title,uri,license,evidence:text,checkedAt:review.checkedAt});
  return {contentVersion:release,contentState:'database-reviewed',foods:allFoods,recipes,
    categories:[...structuredClone(categories).map(c=>({...c,note:c.note.replace('此测试目录','当前食材目录')})),{name:'芝麻类',aliases:['芝麻'],targets:['sesame-paste','toasted-sesame','sesame-oil'],note:'芝麻酱、熟白芝麻及香油；具体复合产品仍核验成分'}],relations:[],
    sourceEvidence:{
      recipe:evidence('HowToCook 固定版本普通菜谱资料核对',`https://github.com/Anduin2017/HowToCook/tree/${commit}`,'The Unlicense',`固定LICENSE blob fdddb29aa445bf3d6a5d843d6dd77e10a9f99657；仓库所有者明确菜谱可使用：https://github.com/Anduin2017/HowToCook/issues/1468#issuecomment-2811737432。逐篇blob：${review.selections.map(s=>`${s.id}:${s.blobSha}`).join('；')}。仅原文、配料、用量、步骤及口味结构核对，未实做或专业健康审核。`),
      food:evidence('拾味自有食材名称与成分关系整理','urn:shiwei:food-dictionary:2026-10-23','项目自有结构化食材目录','基本食材名称和别名；来源配方用量单独保存，未知复合调料保持componentsComplete=false；不引用营养数值。'),
      nutrition:evidence('本发布未准入营养数值','urn:shiwei:nutrition:not-provided','不适用：本发布无营养数值','所有nutrition对象为空；来源简介的估算热量及健康功效不导入。'),
    }};
}
