import test from 'node:test';
import assert from 'node:assert/strict';
import { fixedRecipeText, ingredientDisplayText } from '../shared/recipe-copy';

test('固定配方展开来源公式，保留已知用量、可选项和操作说明',()=>{
  for(const [source,display] of [
    ['醋7.5ml＋4ml×份数（原文表达）','醋11.5ml'],
    ['酱油5ml＋2.5ml×份数（原文表达）','酱油7.5ml'],
    ['盐0.4g＋0.2g×份数（原文表达）','盐0.6g'],
    ['香油5ml＋2ml×份数（原文表达）','香油7ml'],
    ['黄瓜200g／原文每份','黄瓜200g'],
    ['白糖5g（步骤给出）','白糖5g'],
    ['白豆腐（原文份数×0.8向上取整；单块重量未知）','白豆腐1块'],
    ['青辣椒1.5只／三份（原文参考）','青辣椒0.5只'],
    ['葱2根／三份（原文参考）','葱2/3根'],
    ['食用油10ml（原文每份，步骤另加5ml）','食用油15ml'],
    ['韭菜100g（原文每份）','韭菜100g'],
    ['盐（用量未注明）','盐'],
    ['胡萝卜50g（可省）','胡萝卜50g（可省）'],
    ['蒜4瓣（切末）','蒜4瓣（切末）'],
  ]){
    assert.equal(ingredientDisplayText(source),display);
    assert.equal(ingredientDisplayText(display),display);
  }
  assert.equal(fixedRecipeText('热锅，加入份数 * 9ml 油。'),'热锅，加入9ml 油。');
});
