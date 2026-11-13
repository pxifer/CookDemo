"""Offline selection from public MIRecipe archives; keep every selected source field."""
from pathlib import Path
import json,re,hashlib
root=Path('.local-data/recipe-1000')
base=json.loads(Path('datasets/recipes/expansion-1000/base-bundle.json').read_text(encoding='utf-8'))
full=json.loads((root/'mirecipe-full.json').read_text(encoding='utf-8'));full.update(json.loads((root/'mirecipe.json').read_text(encoding='utf-8')))
def key(n):
 n=re.sub(r'[【\[].*?[】\]]|[（(].*?[）)]|[\s·•\-]','',n)
 for a,b in [('西红柿','番茄'),('西红杮','番茄'),('蒜台','蒜薹'),('蒜苔','蒜薹'),('菜花','花菜'),('卷心菜','包菜'),('牛扒','牛排'),('鸡蛋','蛋'),('清蒸蛋','蒸蛋'),('新奥尔良','奥尔良'),('美味',''),('懒人版',''),('家常版',''),('简易版',''),('爱心',''),('香煎牛排','煎牛排')]:n=n.replace(a,b)
 return n
seen={key(r['name']) for r in base['listedFoodSnapshot']['recipes']};candidates=[]
exclude='薯条|零食|沙参|玉竹|虫草|五指毛桃|艾茎|饭|粥|面包|面条|意面|方便面|拉面|拌面|打卤面|饺|云吞|馄饨|馒头|包子|包$|饼|馍|油条|蛋糕|饼干|糕|月饼|甜|饮|奶昔|冰淇淋|蛋挞|披萨|布丁|泡芙|糖水|果汁|果酱|寿司|汉堡|凉皮|凉粉|腌|自制|巧存|熬猪油|猪油$|枣泥|养生|营养|药膳|宝宝|婴|儿童|减脂|减肥|降火|滋补|保元|催乳|月子|补肾|吐司|汤圆|元宵|粽|豆浆|米糊|米粉|薯干|红薯|紫薯|地瓜|番薯|板栗|栗子|红糖|冰糖|蜜豆|糖渍|糖霜|糖果|双皮奶|奶酪|巧克力|果冻|西米|黄芪|当归|枇杷|灵芝|川贝|沙参|燕窝|鱼胶|桃胶|银耳|罗汉果|陈皮|山楂|梨|苹果|柚|金桔|橘|香蕉|芒果|葡萄|草莓|蓝莓|莲蓉|红豆|绿豆沙|豆沙|糖浆|奶羹|糖$|酱$|汁$|油$|盐$|粉$|醉虾|生腌|刺身|生鱼片'
anchor='猪|牛肉|牛腩|牛排|羊|鱼|虾|蟹|蛤|蚝|鱿|鸡(?!蛋)|鸭|鹅|肉|排骨|腊肠|火腿|培根|白菜|青菜|菠菜|苋菜|莴笋|油麦|菜心|生菜|空心菜|芹菜|韭菜|茄|土豆|萝卜|豆角|芸豆|扁豆|荷兰豆|四季豆|豇豆|莲藕|竹笋|春笋|黄瓜|冬瓜|丝瓜|苦瓜|南瓜|西葫芦|木耳|菇|菌|豆腐|豆干|香干|腐竹|豆皮|千张|鸡蛋|鸭蛋|鹌鹑蛋|豌豆|毛豆|西兰花|花菜|包菜|海带|紫菜|魔芋'
for r in full.values():
 name=(r.get('recipeName') or '').strip();ing=r.get('ingredients') or [];ss=r.get('seasonings') or [];steps=r.get('instructions') or []
 if not re.fullmatch('[\u4e00-\u9fff]{2,12}',name) or key(name) in seen or re.search(exclude,name):continue
 if not re.search('炒|拌|炖|煲|焖|红烧|干煸|蒸|煎|烤|烧|卤|汤|羹|白灼|白切',name):continue
 if not 1<=len(ing)<=5 or not 2<=len(ss)<=9 or not 3<=len(steps)<=12:continue
 if any(not isinstance(i,dict) or not isinstance(i.get('name'),str) or not re.fullmatch('[\u4e00-\u9fff]{1,12}',i['name'].strip()) or not isinstance(i.get('weight'),str) for i in ing):continue
 if not re.search(anchor,' '.join(i['name'] for i in ing)):continue
 if any(not isinstance(t,str) or not t.strip() or len(t)>45 for t in ss):continue
 ds=[(i.get('description') or '').strip() for i in steps]
 if any(not d or len(d)>200 or '\ufffd' in d for d in ds) or sum(map(len,ds))<80:continue
 if not re.search('炒|煮|蒸|炖|烤|煎|焯', ''.join(ds)):continue
 if re.search('酵母|面粉|大米|糯米|米饭|面条|挂面', ''.join(i['name'] for i in ing)):continue
 candidates.append((len(ing)+len(ss),int(r['recipeID']),r))
def signature(name,names):
 mode=next((mode for mode,pattern in [('拌','拌'),('蒸','蒸'),('烤','烤'),('煎','煎'),('炒','炒|爆|煸'),('炖','炖|煲|汤|羹'),('卤','卤'),('烧','烧|焖')] if re.search(pattern,name)),name)
 identities=sorted({key(n) for n in names if n not in ['葱','姜','蒜','蒜头','大蒜','小葱','盐','食用油','水']})
 return (mode,tuple(identities))
foods={f['id']:f['name'] for f in base['listedFoodSnapshot']['foods']}
signatures={signature(r['name'],[foods[l['foodId']] for l in r['variants'][0]['lines'] if l['role']=='main']) for r in base['listedFoodSnapshot']['recipes']}
candidates.sort(key=lambda x:(x[0],x[1]));chosen=[];step_hashes=set()
for _,_,r in candidates:
 k=key(r['recipeName']);h=hashlib.sha256(json.dumps(r['instructions'],ensure_ascii=False).encode()).hexdigest()
 sig=signature(r['recipeName'],[i['name'] for i in r['ingredients']])
 if k in seen or h in step_hashes or sig in signatures:continue
 signatures.add(sig)
 seen.add(k);step_hashes.add(h);chosen.append(r)
 if len(chosen)==659:break
if len(chosen)!=659:raise ValueError('INSUFFICIENT_DISTINCT_RECIPES')
out=Path('datasets/recipes/expansion-1000');out.mkdir(parents=True,exist_ok=True)
(out/'source-records.json').write_text(json.dumps(chosen,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'eligible':len(candidates),'selected':len(chosen)}))
