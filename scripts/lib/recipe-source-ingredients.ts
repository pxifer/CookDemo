import {listedIngredients,type ListedIngredient} from './listed-food-curation';
import {ingredientNames} from '../../shared/candidate-food-names';
/** Split a source's concatenated seasoning names only when every character is covered.
 * Keep compound products whole, and never assign a grouped numeric amount to each member. */
export function sourceIngredients(card:{main:string[];seasonings:string[]},vocabulary:string[]):ListedIngredient[]{
 const parsed=listedIngredients(card);
 return parsed.flatMap(item=>{
  if(parsed.filter(p=>p.sourceText===item.sourceText).length>1)item={...item,sourceText:item.name};
  const name=item.name.replace(/大概|大约|约莫/g,'').trim();
  const tokens=[...new Set(ingredientNames(name,vocabulary))];
  let remainder=name;for(const token of [...tokens].sort((a,b)=>b.length-a.length))remainder=remainder.replaceAll(token,'');
  if(tokens.length>1&&!remainder){return tokens.map(token=>({...item,name:token,sourceText:token}));}
  return [{...item,name}];
 });
}
