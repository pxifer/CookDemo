const quantityNote='(?:(?:原页|原文|原方|来源)(?:中)?)?(?:未(?:注明|标注|说明|提供|给出|给)(?:具体)?用量|用量(?:未(?:注明|标注|说明)|不明|未知)|未定量|未单列固定用量)';
const hasQuantityNote=new RegExp(quantityNote);
const removeQuantityNotes=(text:string)=>text.replace(new RegExp(quantityNote,'g'),'');

/** Source formulas use one fixed recipe batch, independent of the diner's count. */
export function fixedRecipeText(text:string):string{
  return text
    .replace(/(\d+(?:\.\d+)?)\s*(ml|g)\s*[＋+]\s*(\d+(?:\.\d+)?)\s*\2\s*[×*]\s*份数/g,
      (_,base:string,unit:string,extra:string)=>`${Number((Number(base)+Number(extra)).toFixed(3))}${unit}`)
    .replace(/份数\s*[×*]\s*(\d+(?:\.\d+)?\s*(?:ml|g))/g,'$1')
    .replace(/白豆腐[（(]原文份数×0\.8向上取整；单块重量未知[）)]/g,'白豆腐1块');
}

/** Remove editorial quantity notes while keeping the food, known amounts and optional choices. */
export function ingredientDisplayText(text:string):string{
  return fixedRecipeText(text)
    .replace(/食用油10ml（原文每份，步骤另加5ml）/g,'食用油15ml')
    .replace(/青辣椒1\.5只／三份（原文参考）/g,'青辣椒0.5只')
    .replace(/葱2根／三份（原文参考）/g,'葱2/3根')
    .replace(/[／/]\s*原文每份/g,'')
    .replace(/[（(](?:原文每份|原文表达|步骤给出)[）)]/g,'')
    .replace(/[（(]([^）)]*)[）)]/g,(whole,note:string)=>{
    if(!hasQuantityNote.test(note)&&!/(步骤另提及|做法中使用)/.test(note))return whole;
    const remaining=removeQuantityNotes(note).replace(/步骤另提及|做法中使用/g,'').replace(/^[\s，,；;：:]+|[\s，,；;：:]+$/g,'');
    return remaining?`（${remaining}）`:'';
  }).replace(new RegExp(`(?:[：:，,；;]\\s*)?${quantityNote}\\s*$`),'').trim();
}
