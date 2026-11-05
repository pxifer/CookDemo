import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { randomBytes } from 'node:crypto';
import { CloudBaseAccounts } from '../backend/src/cloudbase-accounts';
import { defaultMeal } from '../shared/types';
import { createApp } from '../backend/src/app';
import { ingredientEvidence } from '../shared/ingredient-evidence';
import { galleryFixture } from './gallery-content.test';
import { galleryContent } from '../backend/src/gallery-content';
import { contentContext } from '../shared/content';
import { checkDish } from '../backend/src/recommendation';
import { mergeAccountValues, reconcileAccountValues } from '../shared/account-merge';
import { applyPersonalSettings, personalSettings } from '../shared/account';
import { open } from '../backend/src/crypto';

test('个人设置排除人数、食材、同餐人及补买选项，恢复时保留当前餐草稿',()=>{
  const source={...defaultMeal(),servings:5,flavor:'微辣',allowBuy:true,raw:'鸡蛋',restrictions:[{id:'self',kind:'avoid' as const,name:'牛肉',scope:'self' as const,status:'confirmed' as const,targets:['beef'],original:'牛肉'},{id:'other',kind:'avoid' as const,name:'羊肉',scope:'additional' as const,status:'confirmed' as const,targets:['lamb'],original:'羊肉'}]};
  const settings=personalSettings(source);assert.equal(settings.servings,1);assert.equal(settings.allowBuy,false);assert.equal(settings.raw,'');assert.equal(settings.restrictions.length,1);
  const current={...defaultMeal(),servings:3,raw:'白菜'};const restored=applyPersonalSettings(current,settings);assert.equal(restored.servings,3);assert.equal(restored.raw,'白菜');assert.equal(restored.flavor,'微辣');
});

test('自动处理并发设置：保留不同字段修改、收藏取消及明确移除，双改硬限制取并集',()=>{
  const restriction={id:'a',kind:'allergy' as const,name:'花生',scope:'self' as const,status:'confirmed' as const,targets:['peanut'],original:'花生'};
  const base={favorites:[{recipeId:'a',variantId:'v'}],defaults:{...defaultMeal(),restrictions:[restriction]}};
  const local={favorites:[],defaults:{...base.defaults,flavor:'微辣',restrictions:[]}};
  const remote={...base,defaults:{...base.defaults,checkSeasonings:true}};
  const next=reconcileAccountValues(local,remote,base);assert.equal(next.defaults?.flavor,'微辣');assert.equal(next.defaults?.checkSeasonings,true);assert.deepEqual(next.defaults?.restrictions,[]);assert.deepEqual(next.favorites,[]);
  const a={...base,defaults:{...base.defaults,restrictions:[{...restriction,targets:['peanut','egg']}]}};
  const b={...base,defaults:{...base.defaults,restrictions:[{...restriction,targets:['peanut','milk']}]}};
  const merged=reconcileAccountValues(a,b,base);assert.equal(merged.defaults?.restrictions[0].status,'conflict');assert.deepEqual(new Set(merged.defaults?.restrictions[0].targets),new Set(['peanut','milk','egg']));
});

test('跨设备合并保留双方饮食范围，状态或范围不一致时保留冲突待核对',()=>{
  const a={...defaultMeal(),restrictions:[{id:'a',kind:'avoid' as const,name:'豆制品',scope:'self' as const,status:'confirmed' as const,targets:['soy'],original:'不用豆制品'}]};
  const b={...defaultMeal(),restrictions:[{...a.restrictions[0],id:'b',targets:['soy','tofu'],status:'pending' as const,original:'待确认豆制品'}]};
  const merged=mergeAccountValues({favorites:[],defaults:a},{favorites:[],defaults:b});
  assert.deepEqual(merged.defaults?.restrictions[0].targets,['soy','tofu']);
  assert.equal(merged.defaults?.restrictions[0].status,'conflict');
  assert.equal(a.restrictions[0].targets.length,1);
});

async function fixture(){
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'') $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  await db.exec(await readFile('deployment/db/account-sync.sql','utf8'));
  const tokens=new Map([['token-a','user-a'],['token-b','user-b']]);
  const passwords=new Map([['user-a','Sw!OldPassword1'],['user-b','Sw!OldPassword2']]);
  const requests:{path:string;token?:string;body?:any}[]=[];
  const fetcher:typeof fetch=async(input,init)=>{
    const path=new URL(String(input)).pathname,headers=new Headers(init?.headers),token=headers.get('authorization')?.replace('Bearer ','');
    const body=init?.body?JSON.parse(String(init.body)):undefined;
    requests.push({path,token:token??undefined,body});
    const result=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
    if(path==='/auth/v1/signin'){
      const id=body.username==='alice'?'user-a':'user-b';
      if(body.password!==passwords.get(id))return result({},401);
      return result({access_token:id==='user-a'?'token-a':'token-b',sub:id,expires_in:7200});
    }
    const uid=tokens.get(token??'');
    if(!uid)return result({},401);
    if(path.endsWith('/introspect'))return result({sub:uid});
    if(path.endsWith('/sudo'))return body.password===passwords.get(uid)?result({sudo_token:'sudo-test'}):result({},401);
    if(path.endsWith('/password')){if(body.sudo_token!=='sudo-test')return result({},403);passwords.set(uid,body.new_password);return result({});}
    const name=path.split('/').at(-1)!;
    const params=Object.keys(body),values=params.map(key=>body[key]);
    await db.exec('RESET ROLE');await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[uid]);await db.exec('SET ROLE authenticated');
    try{const response=await db.query<{value:unknown}>(`SELECT public.${name}(${params.map((key,i)=>`${key}=>$${i+1}`).join(',')}) AS value`,values);return result(response.rows[0].value);}
    finally{await db.exec('RESET ROLE');}
  };
  const options={envId:'shiwei-d2gmiun66b7dc6a4f',cookieKey:randomBytes(32),profileKey:randomBytes(32),keyVersion:'test-v1',fetch:fetcher};
  return {db,accounts:new CloudBaseAccounts(options),options,requests};
}

test('真实账户适配边界：验证身份、加密跨实例同步、CAS冲突、账号隔离与退出撤销',async()=>{
  const {db,accounts,options,requests}=await fixture();
  try{
    await assert.rejects(accounts.login('alice','incorrect'),/用户名或密码/);
    let alice=await accounts.login('alice','Sw!OldPassword1'),bob=await accounts.login('bob','Sw!OldPassword2');
    assert.equal(alice.mustChangePassword,true);
    await assert.rejects(accounts.save(alice,0,{favorites:[],defaults:null}),/初始密码/);
    await accounts.changePassword(alice,'Sw!OldPassword1','Sw!NewPassword1');
    alice=(await accounts.authenticate(accounts.cookie(alice)))!;
    assert.equal(alice.mustChangePassword,false);
    const defaults={...defaultMeal(),aiExcludedFoods:['牛肉'],restrictions:[{id:'test-allergy',name:'花生',kind:'allergy' as const,targets:['peanut'],scope:'self' as const,status:'confirmed' as const,original:'花生过敏'}]};
    const saved=await accounts.save(alice,0,{favorites:[{recipeId:'tomato-egg',variantId:'tomato-egg-light'}],defaults});
    assert.equal(saved.version,1);
    const newInstance=new CloudBaseAccounts(options),resumed=await newInstance.authenticate(accounts.cookie(alice));
    assert.ok(resumed);assert.deepEqual(await newInstance.load(resumed),saved);
    await assert.rejects(newInstance.save(resumed,0,{favorites:[],defaults:null}),/另一设备/);
    assert.deepEqual((await accounts.load(bob)).value,{favorites:[],defaults:null});
    const raw=await db.query<{envelope:unknown}>('SELECT envelope FROM shiwei_account_state WHERE owner_id=$1',['user-a']);
    assert.ok(!JSON.stringify(raw.rows[0].envelope).includes('花生'));
    const decrypted=open(raw.rows[0].envelope as any,options.profileKey,alice.userId,'account-state') as any;
    assert.deepEqual(Object.keys(decrypted.defaults).sort(),['aiExcludedFoods','checkSeasonings','flavor','restrictions','seasonings']);
    assert.deepEqual(decrypted.defaults.aiExcludedFoods,['牛肉']);
    assert.ok(!JSON.stringify(raw.rows[0].envelope).includes('牛肉'));
    assert.ok(!requests.some(r=>r.path.includes('/rdb/')&&JSON.stringify(r.body).includes('花生')));
    assert.match(accounts.cookie(alice),/HttpOnly; Secure; SameSite=Strict/);
    await accounts.logout(alice);assert.equal(await newInstance.authenticate(accounts.cookie(alice)),null);
    assert.equal(await newInstance.authenticate('shiwei_account=tampered'),null);
  }finally{await db.close();}
});

test('RLS：anon禁止个人表与RPC，其他用户无法读取或修改他人密文',async()=>{
  const {db,accounts}=await fixture();
  try{
    await accounts.login('alice','Sw!OldPassword1');
    await db.exec("SET ROLE anon");
    await assert.rejects(db.query('SELECT * FROM shiwei_account_state'));
    await assert.rejects(db.query("SELECT shiwei_session_check(repeat('a',64))"));
    await db.exec('RESET ROLE');await db.exec("SELECT set_config('request.jwt.claim.sub','user-b',false);SET ROLE authenticated");
    assert.equal((await db.query('SELECT * FROM shiwei_account_state')).rows.length,0);
    assert.equal((await db.query("UPDATE shiwei_account_state SET password_initialized=true WHERE owner_id='user-a' RETURNING owner_id")).rows.length,0);
    await assert.rejects(db.query("INSERT INTO shiwei_account_state(owner_id) VALUES('user-a')"));
  }finally{await db.close();}
});

test('账户API拒绝越权、跨源、无效结构及上传本餐食材草稿',async()=>{
  const {db,accounts}=await fixture(),app=await createApp({accounts,origin:'https://test.example',environment:'local'});
  try{
    assert.equal((await app.inject({url:'/api/v1/account/state'})).statusCode,401);
    const initial=await app.inject({url:'/api/v1/auth/session'}),guest=initial.headers['set-cookie']!.toString().split(';')[0],csrf=initial.json().csrfToken;
    const headers={cookie:guest,origin:'https://test.example','x-csrf-token':csrf};
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/login',headers:{...headers,origin:'https://evil.example'},payload:{username:'alice',password:'Sw!OldPassword1'}})).statusCode,403);
    const login=await app.inject({method:'POST',url:'/api/v1/auth/login',headers,payload:{username:'alice',password:'Sw!OldPassword1'}});
    assert.equal(login.statusCode,200);
    const cookie=`${guest}; ${login.headers['set-cookie']!.toString().split(';')[0]}`;
    const state=await app.inject({url:'/api/v1/auth/session',headers:{cookie}});assert.equal(state.json().identity,'account');
    await accounts.changePassword((await accounts.authenticate(cookie))!,'Sw!OldPassword1','Sw!NewPassword1');
    const bundled=await app.inject({url:'/api/v1/auth/session?state=1',headers:{cookie}});assert.equal(bundled.json().identity,'account');assert.equal(bundled.json().accountSnapshot.version,0);
    const bad=await app.inject({method:'POST',url:'/api/v1/account/state',headers:{...headers,cookie},payload:{expectedVersion:0,value:{favorites:[],defaults:{...defaultMeal(),raw:'私人食材草稿'}}}});
    assert.equal(bad.statusCode,400);assert.equal(bad.json().error.code,'INVALID_DEFAULTS');
  }finally{await app.close();await db.close();}
});

test('成分候选解析不改完备性；过敏拦截明列冲突但允许无关未核配方',async()=>{
  const {base,rows}=await galleryFixture(),snapshot=galleryContent(base,rows),before=structuredClone(snapshot);
  const evidence=ingredientEvidence(snapshot);
  assert.equal(evidence.length,snapshot.foods.length);assert.deepEqual(snapshot,before);
  assert.ok(evidence.find(e=>e.sourceName==='生抽酱油')?.declaredPossibleAllergens.includes('soy'));
  assert.ok(evidence.every(e=>e.reviewState!=='pending-source-review'||e.nutritionState==='not-imported'));
  const context=contentContext(snapshot),meal={...defaultMeal(),allowBuy:true,restrictions:[{id:'allergy',kind:'allergy' as const,name:'鸡蛋',targets:['egg'],status:'confirmed' as const,scope:'self' as const,original:'鸡蛋过敏'}]};
  const directConflict=snapshot.recipes.find(r=>r.source.kind==='local-candidate'&&r.variants[0].lines.some(line=>context.components(line.foodId).some(food=>food.id==='egg'||food.allergens.includes('egg'))));
  assert.ok(directConflict,'fixture has an unreviewed recipe that explicitly lists egg');
  assert.equal(checkDish(directConflict,directConflict.variants[0],meal,context).dish,undefined);
  const unrelated=snapshot.recipes.find(r=>r.source.kind==='local-candidate'&&r.variants[0].lines.every(line=>!context.components(line.foodId).some(food=>food.id==='egg'||food.allergens.includes('egg'))));
  assert.ok(unrelated,'fixture has a recipe with no listed egg ingredient');
  assert.ok(checkDish(unrelated,unrelated.variants[0],meal,context).dish,'unrelated source-review gaps do not block a recipe');
});
