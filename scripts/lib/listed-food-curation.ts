import { optionalIngredient } from '../../shared/recipe-ingredients';
import { isInvalidFoodName } from '../../shared/ingredient-matching';
import type { Line } from '../../shared/types';

export interface ListedIngredient { name: string; role: Line['role']; sourceText: string; optional: boolean }
/** A source card entry. A structured entry keeps the amount out of the name so the
 * amount can never be re-read as an ingredient ("菠菜 几颗" must not become two foods).
 * Plain strings still carry their amount inline and are parsed for it. */
export type ListedSource = string | { name: string; amount?: string };

const combined: Record<string,string[]> = {葱姜蒜:['葱','姜','蒜'],葱姜:['葱','姜'],葱姜丝:['葱','姜'],葱姜末:['葱','姜'],姜蒜:['姜','蒜'],油盐:['食用油','盐'],葱蒜:['葱','蒜']};
const cleanNames:Record<string,string>={可乐半听:'可乐',啤酒半罐:'啤酒',小葱头数根:'小葱',蒜数颗:'蒜',青花椒数颗:'青花椒',花椒十余粒:'花椒',白醋数滴:'白醋',盐小:'盐',拌汁用盐:'盐',焯煮用盐:'盐',炸油:'食用油',热油:'食用油',色拉油:'食用油','清洗用小苏打':'小苏打','新鲜的大虾':'大虾','吐净沙的海蛤蜊':'海蛤蜊','裹粉':'面粉','新鲜罗勒':'罗勒','九层塔':'罗勒','柠檬片':'柠檬'};
const countingUnits='个|颗|粒|块|片|根|条|只|朵|把|勺|匙|杯|碗|串|张|节|段|棵|株|枝|瓣|枚|双|对|斤|两|克|毫升|盒|袋|罐|瓶|包|汤匙|茶匙|小把|大把|小勺|大勺|小匙|大匙|小片|小块|小段|点点';
// Amounts. A source amount can carry a unit we do not enumerate (15ml、2.0支、1份) or
// trailing noise ("姜一块啊"), so everything after the numeral is dropped; Chinese
// numerals still need a recognised counting unit so 三文鱼/五花肉/二荆条 are not cut.
const amountTail=new RegExp(
  `(?:约|各|共|大约)?\\s*(?:`
  + `[0-9０-９]+(?:\\.[0-9]+)?.*`
  + `|[一二两三四五六七八九十百千半几数点到]+\\s*(?:大|小|中)?\\s*(?:${countingUnits}).*`
  + `)\\s*$`);
/** Drop a trailing amount from a name. The display text keeps the original wording. */
const withoutAmount=(text:string)=>text
  .replace(amountTail,'')
  // A size word plus a cut ("姜小块"、"五花肉大块") is an amount too, but a plain
  // cut ("鱼片"、"肉片") is a product and must stay.
  .replace(/(?:大|小|中)(?:块|片|段|根|条|颗|朵|把)\s*$/,'')
  .trim();
/** Strip an amount, but never delete a real name that merely looks like one (千张). */
const normalizeName=(raw:string):string=>{
  const stripped=withoutAmount(raw);
  if(stripped)return stripped;
  return isInvalidFoodName(raw)?'':raw;
};

export function listedIngredients(card: {main?:ListedSource[];aux?:ListedSource[];seasonings?:ListedSource[]}): ListedIngredient[] {
  const result:ListedIngredient[]=[];
  const push=(name:string,role:Line['role'],sourceText:string,optional:boolean)=>{
    const cleaned=cleanNames[name]??name;
    if(!cleaned||isInvalidFoodName(cleaned))return;
    for(const item of combined[cleaned]??[cleaned])result.push({name:item==='油'?'食用油':item,role,sourceText,optional});
  };
  for(const [field,role] of [['main','main'],['aux','auxiliary'],['seasonings','seasoning']] as const){
    for(const entry of card[field]??[]){
      // Structured entry: name and amount were separated at the source of truth.
      if(typeof entry!=='string'){
        const strip=/(?:（[^）]*）|\([^)]*\)|\[[^\]]*\])/g;
        const sourceText=`${entry.name.replace(strip,'')} ${(entry.amount??'').replace(strip,'')}`.replace(/\s+/g,' ').trim();
        const name=normalizeName(entry.name.replace(strip,'').trim())
          .replace(/(?:可选|各|约|共|及|和|与|：|:)$/,'').trim();
        push(name,role,sourceText,optionalIngredient(sourceText));
        continue;
      }
      const sourceText=entry;
      const text=entry.replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]/g,'')
        .replace(/(?:腌料|碗汁|料汁|调味汁|炒制用油|滑油|底油|明油|主料|辅料|调料)[:：]/g,'');
      const alternative=/或者|或|[／/]/.test(text);
      let alternativeIndex=0;
      for(const fragment of text.split(/[、，,；;＋+\s]+|或者|或|\sor\s|(?<![0-9０-９])[／/]|[／/](?![0-9０-９])/u)){
        let name=fragment.trim().replace(/^(?:另外|另加|加入|可选|可省|约|适量|少许|少量|各适量|及|和|与)\s*/,'');
        name=name.split(/用于|用来|至没过|没过|剁成|切成|切末|打成|备用|步骤另提及/)[0]
          .replace(/(?:各)?(?:适量|少许|少量|若干|用量未注明|原页未注明用量).*$/,'')
          .trim();
        name=normalizeName(name)
          .replace(/(?:可选|各|约|共|及|和|与|：|:)$/,'').replace(/[:：].*$/,'').trim();
        if(!name||/^(?:切碎|拍碎|去皮|洗净|沥干|捞出|未注明|原方|锅中用油|炒制用油|炒制用|底油与明油)$/.test(name))continue;
        if(/后续调汤|煎豆腐与炒菜另用|来源未给用量/.test(name))continue;
        push(name,role,sourceText,optionalIngredient(sourceText)||alternative&&alternativeIndex++>0);
      }
    }
  }
  return result.filter((item,index)=>result.findIndex(other=>other.name===item.name&&other.role===item.role&&other.optional===item.optional)===index);
}
