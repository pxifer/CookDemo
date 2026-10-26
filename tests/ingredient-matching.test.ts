import test from 'node:test';
import assert from 'node:assert/strict';
import { constructedContent } from '../shared/catalog';
import { contentContext } from '../shared/content';
import { findPantryIngredient, resolvePantryFood } from '../shared/ingredient-matching';
import { extractText, makeRestriction } from '../shared/extraction';
import { defaultMeal, type Food, type Line } from '../shared/types';
import { inputIngredient, mergeInput, normalizeInput } from '../src/meal-input';
import { checkDish, recommend } from '../server/recommendation';
import { request, simpleRecipe } from './fixtures';

const food = (name: string): Food => ({id:`test-${name}`,name,aliases:[],unit:'g',form:'raw',allergens:[],componentsComplete:true,nutrition:{}});
const line = (foodId: string): Line => ({foodId,amount:null,unit:'g',role:'main',basis:'unknown',form:'raw'});

test('统一食材匹配覆盖大类、品种、加工描述、中文异写和名称包含',()=>{
  const cases=[['猪肉','五花肉'],['鸡肉','鸡腿肉'],['牛肉','牛腩'],['羊肉','羊排'],['鱼','鲤鱼'],['虾','黑虎虾'],
    ['粉条','土豆干粉条'],['粉条','红薯粉丝'],['土豆','小土豆'],['番茄','小番茄'],['白菜','白菜心'],['白菜','娃娃菜'],
    ['香菇','鲜香菇'],['蘑菇','金针菇'],['菌菇','口蘑'],['豆腐','内酯豆腐'],['青椒','螺丝椒'],['西蓝花','西兰花'],
    ['洋葱','黄洋葱'],['面粉','低筋面粉'],['  香 菇  ','干香菇']];
  for(const [typed,required] of cases){
    const target=food(required),context=contentContext({...constructedContent,foods:[...constructedContent.foods,target]});
    const item=inputIngredient(typed,context);
    assert.equal(item.status,'confirmed',typed);
    assert.ok(findPantryIngredient(line(target.id),[item],context.foodById),`${typed} -> ${required}`);
  }
});

test('包含匹配不跨动物、调料成品、淀粉、米粉和具体食材来源',()=>{
  const cases=[['猪肉','牛里脊'],['猪肉','鱼肉馅'],['鸡肉','鸡精'],['牛肉','牛肉高汤'],['鱼','鱼丸'],['虾','虾皮'],
    ['粉条','米粉'],['粉条','面粉'],['土豆','土豆淀粉'],['土豆','土豆干粉条'],['花生','花生油'],
    ['豆腐','日本豆腐'],['豆腐','豆腐乳'],['白菜','东北酸菜'],['黄豆','黄豆芽'],['红薯粉条','土豆干粉条'],['花菜','黄花菜'],['葫芦','干葫芦巴叶']];
  for(const [typed,required] of cases){
    const source=food(typed),target=food(required),context=contentContext({...constructedContent,foods:[...constructedContent.foods.filter(f=>f.name!==typed),source,target]});
    const item={...inputIngredient(typed,context),foodId:source.id,status:'confirmed' as const};
    assert.equal(findPantryIngredient(line(target.id),[item],context.foodById),undefined,`${typed} must not match ${required}`);
  }
  assert.equal(resolvePantryFood('粉',constructedContent.foodById),undefined);
  assert.equal(resolvePantryFood('神秘食物',constructedContent.foodById),undefined);
});

test('目录中的局部名称可从文字输入走到推荐，不伪造数量或限制范围',async()=>{
  const flour=food('低筋面粉'),recipe=simpleRecipe('flour',[ [flour.id,100] ]);
  const context=contentContext({...constructedContent,foods:[...constructedContent.foods,flour],recipes:[recipe]});
  const extracted=extractText('面粉200g',context);
  assert.equal(extracted.ingredients.length,1);assert.deepEqual(extracted.unresolved,[]);
  assert.match(extracted.ingredients[0].foodId!,/^pantry-query-/);
  const meal={...defaultMeal(),ingredients:mergeInput([],extracted.ingredients)};
  assert.equal(normalizeInput(meal,context).ingredients[0].foodId,meal.ingredients[0].foodId);
  const result=await recommend([recipe],request(meal),{context});
  assert.equal(result.dishes[0].recipe.id,'flour');
  assert.equal(result.dishes[0].checks[0].state,'unverified');
  assert.equal(result.dishes[0].checks[0].shortage,null);
  assert.deepEqual(context.restrictionTargets('面粉'),[]);
  assert.equal(makeRestriction('面粉','allergy','self',context).status,'unknown');
  const continuous=extractText('面粉200g鸡蛋2个',context);
  assert.deepEqual(continuous.unresolved,[]);
  assert.equal(continuous.ingredients.find(item=>item.foodId?.startsWith('pantry-query-'))?.amount,'200g');
  assert.equal(continuous.ingredients.find(item=>item.foodId==='egg')?.amount,'2个');
});

test('旧草稿只恢复程序误造的未分类食材，保留用户真实过敏与忌口',()=>{
  const legacy=makeRestriction('未分类：粉条','unclassified'),avoid=makeRestriction('怪果','avoid'),allergy=makeRestriction('花生','allergy');
  const meal={...defaultMeal(),ingredients:[{...inputIngredient('粉条'),foodId:null,status:'pending' as const}],restrictions:[legacy,avoid,allergy]};
  const normalized=normalizeInput(meal);
  assert.equal(normalized.ingredients.length,1);
  assert.equal(normalized.ingredients[0].foodId,'ingredient-family-vermicelli');
  assert.equal(normalized.ingredients[0].status,'confirmed');
  assert.deepEqual(normalized.restrictions.map(r=>r.id),[avoid.id,allergy.id]);
});

test('原方缺少用量仍要核对食材存在，未允许补买不能混入缺料菜',()=>{
  const recipe=simpleRecipe('unknown-amount',[['pork',100]]);recipe.variants[0].lines[0].amount=null;
  const meal={...defaultMeal(),ingredients:[inputIngredient('白菜')]};
  assert.equal(checkDish(recipe,recipe.variants[0],meal).dish,undefined);
  const buying=checkDish(recipe,recipe.variants[0],{...meal,allowBuy:true}).dish!;
  assert.equal(buying.checks[0].state,'missing');assert.equal(buying.checks[0].shortage,null);
});
