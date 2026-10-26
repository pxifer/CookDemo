/** “可选牛腩或牛尾” chooses a required ingredient's cut; it does not make beef optional. */
export const optionalIngredient = (text: string) => /可省|可不[放加用]|可以不[放加用]|也可不[放加用]|没有[^）)]{0,12}不放|可选(?=[，,；;）)\s]|$)|非必需|不是必需/.test(text);
export const requiredIngredientText = (lines: string[]) => lines.filter(s => !optionalIngredient(s)).join(' ');
