import { optionalIngredient } from '../../shared/recipe-ingredients';
import type { Line } from '../../shared/types';

export interface ListedIngredient { name: string; role: Line['role']; sourceText: string; optional: boolean }
const combined: Record<string,string[]> = {葱姜蒜:['葱','姜','蒜'],葱姜:['葱','姜'],葱姜丝:['葱','姜'],葱姜末:['葱','姜'],姜蒜:['姜','蒜'],油盐:['食用油','盐'],葱蒜:['葱','蒜']};
const cleanNames:Record<string,string>={可乐半听:'可乐',啤酒半罐:'啤酒',小葱头数根:'小葱',蒜数颗:'蒜',青花椒数颗:'青花椒',花椒十余粒:'花椒',白醋数滴:'白醋',盐小:'盐',拌汁用盐:'盐',焯煮用盐:'盐',炸油:'食用油',热油:'食用油',色拉油:'食用油','清洗用小苏打':'小苏打','新鲜的大虾':'大虾','吐净沙的海蛤蜊':'海蛤蜊','裹粉':'面粉','新鲜罗勒':'罗勒','九层塔':'罗勒','柠檬片':'柠檬'};
export function listedIngredients(card: {main?:string[];aux?:string[];seasonings?:string[]}): ListedIngredient[] {
  const result: ListedIngredient[]=[];
  for(const [field,role] of [['main','main'],['aux','auxiliary'],['seasonings','seasoning']] as const){
    for(const sourceText of card[field]??[]){
      const text=sourceText.replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]/g,'')
        .replace(/(?:腌料|碗汁|料汁|调味汁|炒制用油|滑油|底油|明油|主料|辅料|调料)[:：]/g,'');
      const alternative=/或者|或|[／/]/.test(text);
      let alternativeIndex=0;
      for(const fragment of text.split(/[、，,；;＋+\s/／]+|或者|或|\sor\s/)){
        let name=fragment.trim().replace(/^(?:另外|另加|加入|可选|可省|约|适量|少许|少量|各适量|及|和|与)\s*/,'');
        name=name.split(/用于|用来|至没过|没过|剁成|切成|切末|打成|备用|步骤另提及/)[0]
          .replace(/(?:各)?(?:适量|少许|少量|若干|用量未注明|原页未注明用量).*$/,'')
          .replace(/(?:约|各|共)?\s*(?:\d|[半一二两三四五六七八九十百]+\s*(?:克|毫升|斤|两|个|颗|根|瓣|片|勺|匙|把|块|只|条|袋|杯|升|小把|小勺|大勺|小匙|大匙|碗|段)).*$/,'')
          .replace(/(?:可选|各|约|共|及|和|与|：|:)$/,'').replace(/[:：].*$/,'').trim();
        if(!name||/^(?:切碎|拍碎|去皮|洗净|沥干|捞出|未注明|原方|锅中用油|炒制用油|炒制用|底油与明油)$/.test(name))continue;
        if(/后续调汤|煎豆腐与炒菜另用|来源未给用量/.test(name))continue;
        name=cleanNames[name]??name;
        if(name==='油')name='食用油';
        for(const item of combined[name]??[name])result.push({name:item,role,sourceText,optional:optionalIngredient(sourceText)||alternative&&alternativeIndex++>0});
      }
    }
  }
  return result.filter((item,index)=>result.findIndex(other=>other.name===item.name&&other.role===item.role&&other.optional===item.optional)===index);
}
