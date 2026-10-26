const quantityNote='(?:(?:原页|原文|原方|来源)(?:中)?)?(?:未(?:注明|标注|说明|提供|给出|给)(?:具体)?用量|用量(?:未(?:注明|标注|说明)|不明|未知)|未定量|未单列固定用量)';
const hasQuantityNote=new RegExp(quantityNote);
const removeQuantityNotes=(text:string)=>text.replace(new RegExp(quantityNote,'g'),'');

/** Remove editorial quantity notes while keeping the food, known amounts and optional choices. */
export function ingredientDisplayText(text:string):string{
  return text.replace(/[（(]([^）)]*)[）)]/g,(whole,note:string)=>{
    if(!hasQuantityNote.test(note)&&!/(步骤另提及|做法中使用)/.test(note))return whole;
    const remaining=removeQuantityNotes(note).replace(/步骤另提及|做法中使用/g,'').replace(/^[\s，,；;：:]+|[\s，,；;：:]+$/g,'');
    return remaining?`（${remaining}）`:'';
  }).replace(new RegExp(`(?:[：:，,；;]\\s*)?${quantityNote}\\s*$`),'').trim();
}
