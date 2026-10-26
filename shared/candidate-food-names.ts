// Literal names appearing in the local source records. This is a recognition vocabulary,
// not approval of aliases, composition, nutrition or interchangeable cuts.
export const candidateFoodNames = `娃娃菜 金针菇 皮蛋 午餐肉 猪肉末 葱花 胡椒粉 水淀粉 干木耳 小米辣 芥末 莴笋 萝卜 蒜头 姜片 凉白开水 麻油 香醋 鲜香菇 食用盐 开水 包菜 粉丝 菜籽油 花菜 洋葱 青辣椒 香菜叶 姜黄粉 香菜粉 孜然籽 红辣椒粉 印度综合香料粉 瓠瓜 鹰嘴豆粉 孜然粉 清水 热水 水 鸡 香菜 花椒粉 红油 鸡翅中 鸡翅 可乐 梅头猪肉 罐头菠萝片 蒜蓉 茄汁 白醋 白砂糖 肥牛卷 纯牛奶 咖喱块 鳝丝 姜末 蒜末 鳝鱼 猪油 鸭肉 啤酒 生抽酱油 老抽酱油 丁香 五花肉 二刀肉 青红椒 蒜苗 肋排 黄豆酱 茄子 尖椒 菜椒 甜椒 干线椒 大葱 香果 手枪腿 新奥尔良烤翅调料 豉油调味汁 白蘑菇 面粉 黑胡椒碎 黄油 牛奶 淡奶油 鸡腿肉 鸡腿 盐焗鸡粉 鸡胸肉 熟花生 莴笋 二荆条 植物油 淀粉 油泼辣子 莲藕 生鸡肝 芝麻 烧烤料 牛里脊 芹菜 小米椒 野山椒 花生油 老姜 花椒碎 花椒粒 红薯淀粉 十三香 板栗 山药 小南瓜 红枣 排骨 玉米 猪里脊 木耳 蒜苔 葱头 番茄 螺丝椒 原味酸奶 Masala 姜粉 蒜粉 猪前肘 蒜片 肘子 红豆腐乳 甜面酱 精盐 红酱油 白酱油 阿根廷红虾 柠檬 海盐 白葡萄酒 橄榄油 郫县红油豆瓣酱 牛腩 白萝卜 葱结 南乳 柱侯酱 苦瓜 虾皮 长条青椒 鸡爪 柠檬汁 黑醋 花椒油 日本豆腐 火腿肠 黑木耳 番茄酱 昂刺鱼 沙光鱼 玉米粒 熟松子仁 羊腩 炸腐竹 红葱头 葱段 腐乳 砂糖 南腐乳 甘草 郫县豆瓣酱 花雕酒 白酒 柱候酱 叉烧酱 梅干菜 梅菜 四季豆 橄榄菜 豆芽 红辣椒 干辣椒粉 黑虎虾 明虾 黄酒 葱油 猪肉片 蕃茄酱 南瓜 生蚝 蒸鱼豉油 桂鱼 鳜鱼 红椒 带皮五花肉 干小米椒 鸭子 糯米粉 粘米粉 蒸肉粉 细辣椒粉 黄洋葱 低筋面粉 冰水 玉米淀粉 蜂蜜 草鱼 灯笼椒 芹菜段 千张 绿豆芽 熟花生米 白芝麻 大蒜粒 干辣椒段 青花椒 牛排 口蘑 小土豆 小番茄 百里香 蘑菇 预制牛排酱汁 猪排骨 东北酸菜 鸡全翅 甜椒粉 八角 味素 纯瘦肉 新鲜菜心 土豆干粉条 paprika 中筋面粉 洋葱粉 泡打粉 里脊肉 鲤鱼 豆角 干紫菜 猪蹄 鱼头 美人椒 味极鲜 牛肉高汤 番茄罐头 欧芹 红肠 蔬菜高汤 番茄膏 羊肉 羊杂 芝麻香油 红腐乳 葱白 腐乳汁 罗氏虾 青芥末 朗姆酒 闽星茶树菇 茭白 荷兰豆 腊肠 羊排 白芷 白豆腐 香芹 新鲜空心菜 无盐黄油 肉桂皮 猪肘 食用植物油 豆蔻 红薯粉丝 蟹味菇 白玉菇 西蓝花 生菜叶 生菜 蛏子 西葫芦 阳江豆豉 白鱔 豆豉 朝天椒 螃蟹 菜油 鸡蛋黄 鱼露 地瓜粉 线椒 剑骨鱼 漓泉啤酒 桂林辣椒酱 土豆淀粉 韭菜 豆干 五花肉条 翘嘴鱼 姜沫 鸡汤 辣椒面 肉末 白菜心 鳊鱼 老豆腐 红尖椒 内酯豆腐 咸鸭蛋 蒜蓉辣酱 青菜 油菜 无骨肉 鱼丸 干豆腐 北京麻辣方便面 油麦菜 鲜虾 黑胡椒粒 米酒 腰果 干葫芦巴叶 酸奶 小豆蔻粉 生姜片 香菇水 猪瘦肉`.split(/\s+/);

export function ingredientNames(text: string, vocabulary: string[]): string[] {
  // Do not turn the object of a preparation instruction into another ingredient
  // (e.g. 盐…用于腌制鱼, 开水至没过豆腐, 蒜…剁成蒜蓉).
  const head = text.replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]/g,'').split(/用于|用来|至没过|没过|剁成|切成|切末|打成|备用|每(?:个|只|条|份)/)[0];
  const words = [...new Set([...vocabulary,...candidateFoodNames])].sort((a,b)=>b.length-a.length);
  const found: string[] = [];
  // Longest non-overlapping literal match prevents 蒜蓉辣酱 from also becoming 蒜/辣椒.
  for(let i=0;i<head.length;){
    const word=words.find(w=>head.startsWith(w,i));
    if(word){found.push(word);i+=word.length;}else i++;
  }
  return [...new Set(found)];
}
