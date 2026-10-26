import type { ContentSnapshot } from './content';

/** Candidate identity links only. These never grant allergy eligibility or nutrition facts. */
export const INGREDIENT_EVIDENCE_VERSION = 'ingredient-evidence-20261025-v2';
export interface IngredientCandidateEvidence {
  foodId: string;
  sourceName: string;
  proposedIdentity: string | null;
  declaredPossibleAllergens: string[];
  reviewState: 'pending-source-review' | 'requires-product-label';
  nutritionState: 'not-imported';
  basis: string;
}
const proposals: {names: string[]; identity:string; allergens:string[]}[] = [];
const group=(names:string,identity:string,allergens:string[]=[])=>proposals.push({names:names.split(/\s+/),identity,allergens});
group('猪肉末 梅头猪肉 五花肉 二刀肉 肋排 排骨 猪里脊 猪前肘 肘子 猪肉片 带皮五花肉 猪排骨 纯瘦肉 里脊肉 猪蹄 猪肘 五花肉条 猪瘦肉 猪油','猪肉');
group('肥牛卷 牛里脊 牛腩 牛排','牛肉');
group('鸡 鸡翅 鸡翅中 手枪腿 鸡腿 鸡腿肉 生鸡肝 鸡爪 鸡全翅','鸡肉');
group('鸭子','鸭肉');group('羊腩 羊杂 羊排','羊肉');
group('鳝丝 鳝鱼 昂刺鱼 沙光鱼 桂鱼 鳜鱼 草鱼 鲤鱼 鱼头 白鱔 剑骨鱼 翘嘴鱼 鳊鱼 鱼露','鱼',['fish']);
group('阿根廷红虾 虾皮 黑虎虾 明虾 罗氏虾 鲜虾','虾',['shellfish']);
group('生蚝 蛏子 螃蟹 蚝油','甲壳/贝类',['shellfish']);
group('鸡蛋黄 皮蛋 咸鸭蛋 日本豆腐','蛋类',['egg']);
group('牛奶 纯牛奶 淡奶油 黄油 无盐黄油 原味酸奶 酸奶','乳类',['milk']);
group('豆腐 白豆腐 老豆腐 内酯豆腐 豆干 干豆腐 千张 炸腐竹 豆瓣酱 黄豆酱 郫县红油豆瓣酱 郫县豆瓣酱 红豆腐乳 南乳 腐乳 南腐乳 红腐乳 腐乳汁 阳江豆豉 豆豉','大豆',['soy']);
group('面粉 低筋面粉 中筋面粉 甜面酱','小麦',['wheat']);
group('生抽 老抽 生抽酱油 老抽酱油 红酱油 白酱油 味极鲜 豉油调味汁 蒸鱼豉油','酱油',['soy','wheat']);
group('芝麻 熟白芝麻 白芝麻 芝麻香油 麻油 香油 芝麻酱','芝麻',['sesame']);
group('花生 熟花生 熟花生米 花生油','花生',['peanut']);
group('腰果 熟松子仁 板栗','坚果',['tree-nut']);
group('蒜头 蒜蓉 蒜末 蒜片 大蒜粒 蒜粉','大蒜');
group('姜末 姜片 老姜 姜粉 姜沫 生姜片','生姜');
group('葱花 大葱 葱结 葱段 葱白','葱');
group('娃娃菜 白菜心','白菜');group('小土豆','土豆');group('小番茄','西红柿');
group('鲜香菇 香菇水','香菇');group('干木耳 黑木耳','木耳');group('西蓝花','西兰花');
group('黄洋葱 洋葱粉','洋葱');group('芹菜段 香芹','芹菜');group('生菜叶','生菜');
group('玉米粒 甜玉米 玉米淀粉 玉米粉 玉米面','玉米');
group('白糖 白砂糖 冰糖 绵白糖','白糖');
group('水 清水 热水 开水 凉白开水 饮用水','饮用水');
// Exact single-food names in the fixed recipe sources. These facts confirm
// intrinsic identity only; packaged blends remain label-bound.
group('金针菇','金针菇');group('木耳','木耳');group('莴笋','莴笋');group('包菜','包菜');group('花菜','花菜');
group('洋葱','洋葱');group('青辣椒','青辣椒');group('香菜叶','香菜叶');group('瓠瓜','瓠瓜');group('香菜','香菜');
group('茄子','茄子');group('尖椒','尖椒');group('菜椒','菜椒');group('甜椒','甜椒');group('白蘑菇','白蘑菇');
group('莲藕','莲藕');group('芹菜','芹菜');group('山药','山药');group('小南瓜','南瓜');group('红枣','红枣');
group('蒜苔','蒜苔');group('螺丝椒','辣椒');group('柠檬','柠檬');group('苦瓜','苦瓜');group('长条青椒','辣椒');
group('红葱头','葱');group('甘草','甘草');group('四季豆','四季豆');group('豆芽 绿豆芽','豆芽');
group('红辣椒 灯笼椒 朝天椒 红尖椒','辣椒');group('青花椒','花椒');group('口蘑','蘑菇');
group('新鲜菜心','菜心');group('豆角','豆角');group('干紫菜','紫菜');group('欧芹','欧芹');group('茭白','茭白');
group('荷兰豆','荷兰豆');group('白芷','白芷');group('新鲜空心菜','空心菜');group('蟹味菇','蘑菇');
group('白玉菇','蘑菇');group('生菜','生菜');group('西葫芦','西葫芦');group('韭菜','韭菜');group('青菜','青菜');
group('油菜','油菜');group('油麦菜','油麦菜');group('小米辣 小米椒 干小米椒','辣椒');
group('干辣椒段','辣椒');group('丁香','丁香');group('孜然籽','孜然');group('百里香','百里香');
group('肉桂皮','肉桂');group('豆蔻','豆蔻');group('鹰嘴豆粉','鹰嘴豆');group('糯米粉','糯米');
group('粘米粉','大米');group('砂糖','白糖');group('冰水','饮用水');
// Additional single-ingredient names present in the recipe source catalog.
// Composite sauces, broths, oils and packaged products remain label-bound.
group('牛肉','牛肉');group('鸡肉','鸡肉');group('羊肉','羊肉');group('鸭肉','鸭肉');
group('鱼','鱼',['fish']);group('虾','虾',['shellfish']);group('鸡蛋','鸡蛋',['egg']);
group('西兰花','西兰花');group('白菜','白菜');group('胡萝卜','胡萝卜');group('黄瓜','黄瓜');
group('冬瓜','冬瓜');group('香叶','香叶');group('虫草花','虫草花');group('八角','八角');
group('桂皮','肉桂');group('孜然','孜然');group('黑胡椒 白胡椒 胡椒粉 黑胡椒碎 黑胡椒粒','胡椒');
group('干辣椒 辣椒粉 红辣椒粉 干辣椒粉 细辣椒粉 辣椒面','辣椒');
group('味精 味素','味精');
group('胡萝卜','胡萝卜');group('桂皮','肉桂');group('黄瓜','黄瓜');group('大蒜','大蒜');
group('生姜','生姜');group('香菇','香菇');group('青椒','青椒');group('猪肉','猪肉');
group('土豆','土豆');group('盐 食用盐 精盐 海盐','盐');group('葱','葱');group('花椒 花椒碎 花椒粒','花椒');
group('菠菜','菠菜');group('西红柿','西红柿');group('萝卜 白萝卜','萝卜');group('玉米','玉米');
group('南瓜','南瓜');group('红椒','辣椒');group('蘑菇','蘑菇');group('蜂蜜','蜂蜜');
group('姜黄粉','姜黄');group('香菜粉','香菜');group('孜然粉','孜然');group('蒜苗','大蒜');
group('干线椒 二荆条 野山椒 线椒 美人椒','辣椒');group('青红椒','辣椒');group('香果','香果');
group('姜粉 姜沫','生姜');group('蒜粉','大蒜');group('甜椒粉 paprika','甜椒');
group('面粉 低筋面粉 中筋面粉','小麦',['wheat']);group('番茄膏','西红柿');
group('干葫芦巴叶','葫芦巴');group('小豆蔻粉','豆蔻');
const dictionary = new Map(proposals.flatMap(p=>p.names.map(name=>[name,p] as const)));
const productNames = new Set(`陈醋 鸡精 辣椒油 料酒 豆瓣酱 五香粉 食用油 蚝油 香油 芝麻酱 淀粉 米醋 午餐肉 水淀粉 芥末 麻油 香醋 粉丝 菜籽油 红油 啤酒 可乐 罐头菠萝片 茄汁 白醋 纯牛奶 猪油 生抽 老抽 生抽酱油 老抽酱油 黄豆酱 新奥尔良烤翅调料 豉油调味汁 黄油 牛奶 淡奶油 植物油 油泼辣子 花生油 红薯淀粉 十三香 原味酸奶 Masala 红豆腐乳 甜面酱 红酱油 白酱油 白葡萄酒 橄榄油 郫县红油豆瓣酱 柱侯酱 柠檬汁 黑醋 花椒油 火腿肠 番茄酱 腐乳 南腐乳 郫县豆瓣酱 花雕酒 白酒 柱候酱 叉烧酱 梅菜 梅干菜 橄榄菜 黄酒 葱油 蕃茄酱 蒸鱼豉油 玉米淀粉 预制牛排酱汁 东北酸菜 土豆干粉条 酸奶 牛肉高汤 番茄罐头 红肠 蔬菜高汤 芝麻香油 红腐乳 腐乳汁 青芥末 朗姆酒 腊肠 无盐黄油 食用植物油 红薯粉丝 阳江豆豉 豆豉 菜油 漓泉啤酒 桂林辣椒酱 土豆淀粉 鸡汤 蒜蓉辣酱 无骨肉 鱼丸 北京麻辣方便面 米酒 泡打粉 烧烤料 蒸肉粉 印度综合香料粉 日本豆腐`.split(/\s+/));

// Only exact, recognisable whole-food names are eligible for this identity proof.
// It confirms the named food and its intrinsic allergen family, never a brand formula.
const wholeFoodNames=new Set(`猪肉 猪肉末 梅头猪肉 五花肉 二刀肉 肋排 猪里脊 猪前肘 肘子 猪肉片 带皮五花肉 猪排骨 纯瘦肉 里脊肉 猪蹄 猪肘 五花肉条 猪瘦肉 肥牛卷 牛肉 牛里脊 牛腩 牛排 鸡 鸡肉 鸡翅 鸡翅中 手枪腿 鸡腿 鸡腿肉 生鸡肝 鸡爪 鸡全翅 鸭子 鸭肉 羊肉 羊腩 羊杂 羊排 鳝丝 鳝鱼 昂刺鱼 沙光鱼 桂鱼 鳜鱼 草鱼 鲤鱼 鱼 鱼头 白鱔 剑骨鱼 翘嘴鱼 鳊鱼 阿根廷红虾 虾 虾皮 黑虎虾 明虾 罗氏虾 鲜虾 生蚝 蛏子 螃蟹 鸡蛋 鸡蛋黄 皮蛋 咸鸭蛋 牛奶 纯牛奶 淡奶油 黄油 无盐黄油 原味酸奶 酸奶 豆腐 白豆腐 老豆腐 内酯豆腐 豆干 干豆腐 千张 炸腐竹 芝麻 熟白芝麻 白芝麻 花生 熟花生 熟花生米 腰果 熟松子仁 板栗 蒜头 大蒜 蒜蓉 蒜末 蒜片 大蒜粒 姜末 姜片 老姜 生姜 生姜片 葱 葱花 大葱 葱结 葱段 葱白 娃娃菜 白菜 白菜心 胡萝卜 小土豆 土豆 小番茄 西红柿 鲜香菇 香菇 干木耳 黑木耳 西蓝花 西兰花 黄洋葱 洋葱 芹菜段 香芹 生菜叶 玉米 玉米粒 甜玉米 玉米淀粉 玉米粉 玉米面 白糖 白砂糖 冰糖 绵白糖 水 清水 热水 开水 凉白开水 饮用水 金针菇 木耳 莴笋 包菜 花菜 青辣椒 香菜叶 瓠瓜 香菜 茄子 尖椒 菜椒 甜椒 白蘑菇 莲藕 芹菜 山药 小南瓜 南瓜 红枣 蒜苔 螺丝椒 柠檬 苦瓜 长条青椒 红葱头 甘草 四季豆 豆芽 红辣椒 灯笼椒 绿豆芽 青花椒 花椒 口蘑 新鲜菜心 豆角 干紫菜 欧芹 茭白 荷兰豆 白芷 新鲜空心菜 蟹味菇 白玉菇 生菜 西葫芦 朝天椒 韭菜 红尖椒 青菜 油菜 油麦菜 小米辣 小米椒 干小米椒 干辣椒段 丁香 孜然籽 百里香 肉桂皮 豆蔻 鹰嘴豆粉 糯米粉 粘米粉 冰水 砂糖 香叶 虫草花 冬瓜 八角 孜然 黑胡椒 白胡椒 胡椒粉 黑胡椒碎 黑胡椒粒 干辣椒 辣椒粉 红辣椒粉 干辣椒粉 细辣椒粉 辣椒面 味精 味素 桂皮 盐 食用盐 精盐 海盐 萝卜 白萝卜 姜黄粉 香菜粉 孜然粉 青红椒 干线椒 二荆条 野山椒 香果 姜粉 蒜粉 红椒 蜂蜜 甜椒粉 paprika 番茄膏 干葫芦巴叶 小豆蔻粉 面粉 低筋面粉 中筋面粉`.split(/\s+/));

export function ingredientEvidence(snapshot: ContentSnapshot): IngredientCandidateEvidence[] {
  return snapshot.foods.map(food=>{
    const proposal=dictionary.get(food.name);
    return {foodId:food.id,sourceName:food.name,proposedIdentity:proposal?.identity??null,
      declaredPossibleAllergens:[...new Set([...food.allergens,...(proposal?.allergens??[])])],
      reviewState:productNames.has(food.name)?'requires-product-label':'pending-source-review',
      nutritionState:'not-imported',basis:'原方名称及候选身份关联；尚未形成已核验成分事实，不用于放行过敏/忌口推荐'};
  });
}

export function verifiedIngredientIdentities(snapshot:ContentSnapshot){
  return snapshot.foods.flatMap(food=>{
    if(!wholeFoodNames.has(food.name))return [];
    const proposal=dictionary.get(food.name);if(!proposal)return [];
    const identityId=snapshot.foods.find(candidate=>candidate.name===proposal.identity)?.id;
    return [{foodId:food.id,identityId:identityId===food.id?undefined:identityId,
      allergens:[...new Set([...food.allergens,...proposal.allergens])],
      evidence:`名称“${food.name}”与固定菜谱配料原文一致，按完整食材名称核对为${proposal.identity}；不适用于品牌或复合配料。`}];
  });
}
