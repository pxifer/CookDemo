export const nutritionConditionLabels:Record<string,string>={exerciseTraining:'是否规律进行运动训练',unintentionalWeightLoss:'近期是否有突然或非自愿体重下降',yogurtTolerance:'是否已知可以耐受酸奶',hardCheeseTolerance:'是否已知可以耐受切达或瑞士硬奶酪',gerdTriggerCitrus:'是否已确认柑橘类水果诱发反流',gerdTriggerTomato:'是否已确认番茄诱发反流',gerdTriggerCoffee:'是否已确认咖啡诱发反流',gerdTriggerChocolate:'是否已确认巧克力诱发反流',gerdTriggerMint:'是否已确认薄荷诱发反流',gerdTriggerSpicy:'是否已确认辛辣食物诱发反流',gerdTriggerAlcohol:'是否已确认含酒精饮品诱发反流'};
export const nutritionFollowupPairs:Record<string,[string,string]>={exerciseTraining:['我规律进行运动训练','我没有进行运动训练'],unintentionalWeightLoss:['我有非自愿体重下降','我没有非自愿体重下降'],yogurtTolerance:['我已知可以耐受酸奶','我已知不能耐受酸奶'],hardCheeseTolerance:['我已知可以耐受切达或瑞士硬奶酪','我已知不能耐受切达或瑞士硬奶酪']};
const triggers=[['Citrus','柑橘类水果'],['Tomato','番茄'],['Coffee','咖啡'],['Chocolate','巧克力'],['Mint','薄荷'],['Spicy','辛辣食物'],['Alcohol','含酒精饮品']] as const;
for(const [key,label] of triggers)nutritionFollowupPairs[`gerdTrigger${key}`]=[`我已确认${label}诱发反流`,`我已确认${label}不诱发反流`];
export function reportedNutritionConditions(text:string):Record<string,string>{
  const result:Record<string,string>={};
  for(const part of text.normalize('NFKC').split(/[。；，\n]/)){
    if(!/^\s*我/.test(part))continue;
    let uncertain=false;
    for(const [key,label] of Object.entries(nutritionConditionLabels))if(part.includes(`我不清楚${label}`)){result[key]='unknown';uncertain=true;}
    if(uncertain||/如果|假如|假设|是否|是不是|[?？]|吗\s*$/.test(part))continue;
    for(const [key,pair] of Object.entries(nutritionFollowupPairs))for(const [index,sentence] of pair.entries())if(part.includes(sentence))result[key]=index===0?'yes':'no';
    if(/我(?:规律运动|规律训练|正在进行运动训练)/.test(part))result.exerciseTraining='yes';
    if(/我(?:没有|未进行)运动训练/.test(part))result.exerciseTraining='no';
    if(/我(?:没有|无)(?:突然或)?非自愿体重下降/.test(part))result.unintentionalWeightLoss='no';
    if(/我(?:有|出现)(?:突然|不明原因|非自愿)体重下降/.test(part))result.unintentionalWeightLoss='yes';
  }
  return result;
}
