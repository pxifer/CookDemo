import {listedIngredients,type ListedIngredient,type ListedSource} from './listed-food-curation';
import {ingredientNames} from '../../shared/candidate-food-names';
import {isInvalidFoodName} from '../../shared/ingredient-matching';
/** Split a source's concatenated seasoning names only when every character is covered.
 * Keep compound products whole, and never assign a grouped numeric amount to each member. */
export function mergeSourceIngredients(parsed:ListedIngredient[],vocabulary:string[]):ListedIngredient[]{
 return parsed.flatMap(item=>{
  if(parsed.filter(p=>p.sourceText===item.sourceText).length>1)item={...item,sourceText:item.name};
  const name=item.name.replace(/大概|大约|约莫/g,'').trim();
  // The vocabulary can split a real name into a fragment ("蒜瓣" → 蒜 + 瓣), so a
  // candidate token must clear the same amount check as any other name.
  const tokens=[...new Set(ingredientNames(name,vocabulary))].filter(token=>!isInvalidFoodName(token));
  let remainder=name;for(const token of [...tokens].sort((a,b)=>b.length-a.length))remainder=remainder.replaceAll(token,'');
  if(tokens.length>1&&!remainder){return tokens.map(token=>({...item,name:token,sourceText:token}));}
  return [{...item,name}];
 });
}
export function sourceIngredients(card:{main:ListedSource[];seasonings:ListedSource[]},vocabulary:string[]):ListedIngredient[]{
 return mergeSourceIngredients(listedIngredients(card),vocabulary);
}
