import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './registration-fixture';
import { createApp } from '../server/app';
import { CloudBaseAccounts } from '../server/cloudbase-accounts';
import { defaultMeal } from '../shared/types';
import { seal } from '../server/crypto';
import { constructedContent } from '../shared/catalog';
import { expandFoodSuggestions, withoutExistingRestrictions, withoutRepeatedFoodText } from '../shared/health-guidance';
const key='sk-saved-account-test-only-123456789';
async function user(accounts:Awaited<ReturnType<typeof fixture>>['accounts'],name:string){const code=await accounts.registrationCode(`${name}@example.invalid`,name);return accounts.register({username:name,password:'Saved!Test123',code:'123456',challenge:code.challenge},name);}

test('账户Key服务端密文保存，重登/另一实例可用，公开状态/普通设置不泄漏或覆盖，清空即停用',async()=>{
  const {db,accounts,options}=await fixture();try{
    const alice=await user(accounts,'saved-alice'),bob=await user(accounts,'saved-bob');
    const configured=await accounts.setHealthKey(alice,0,key);assert.deepEqual(configured.healthKey,{configured:true,last4:key.slice(-4)});assert(!JSON.stringify(configured).includes(key));
    const raw=(await db.query('SELECT envelope FROM shiwei_account_state')).rows;assert(!JSON.stringify(raw).includes(key));
    const newer=new CloudBaseAccounts(options);assert.equal((await newer.healthKey(alice)).apiKey,key);assert.equal((await newer.healthKey(bob)).apiKey,'');
    const saved=await newer.save(alice,configured.version,{favorites:[],defaults:{...defaultMeal(),flavor:'微辣'}});assert.equal((await accounts.healthKey(alice)).apiKey,key);
    await assert.rejects(accounts.setHealthKey(alice,0,null),/变更/);
    await accounts.logout(alice);const again=await accounts.login('saved-alice','Saved!Test123');assert.equal((await accounts.healthKey(again)).apiKey,key);
    const cleared=await accounts.setHealthKey(again,saved.version,null);assert.deepEqual(cleared.healthKey,{configured:false});assert.equal((await newer.healthKey(again)).apiKey,'');
    assert.equal((await accounts.load(again)).value.defaults?.flavor,'微辣');
  }finally{await db.close();}
});

test('已存Key聊天不接收浏览器替代凭证，资料与建议随账号保存，已有忌口过敏及别名不再表达',async()=>{
  const {db,accounts}=await fixture();let calls=0;
  const app=await createApp({accounts,healthChatFetch:async(_url,init)=>{calls++;assert.equal(new Headers(init?.headers).get('authorization'),`Bearer ${key}`);return Response.json({id:'saved-key-proof-12345678',model:'deepseek-flash',usage:{prompt_tokens:30,completion_tokens:20,total_tokens:50},choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'花生应排除。番茄也已避开。接下来看看新的搭配。',stage:'advice',profile:{conditions:['测试健康关注'],goals:['增肌'],notes:''},suggestions:[{foodName:'花生',direction:'avoid',reason:'构造理由',conditions:''},{foodName:'番茄',direction:'prefer',reason:'构造理由',conditions:''},{foodName:'牛肉',direction:'prefer',reason:'构造理由',conditions:'',topics:['goal:增肌']}]})}}]});}});
  try{
    const alice=await user(accounts,'advice-alice');const session=await app.inject('/api/v1/auth/session');const headers={cookie:`${String(session.headers['set-cookie']).split(';')[0]}; ${accounts.cookie(alice).split(';')[0]}`,origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
    const request={operationId:crypto.randomUUID(),diseases:[],messages:[{role:'user',content:'我想增肌，已有测试健康关注'}]};
    assert.equal((await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:request})).json().error.code,'CHAT_KEY_REQUIRED');assert.equal(calls,0);
    const keySave=await app.inject({method:'POST',url:'/api/v1/account/health-key',headers,payload:{expectedVersion:0,apiKey:key}});assert.equal(keySave.statusCode,200);assert(!keySave.body.includes(key));
    const defaults={...defaultMeal(),restrictions:[{id:'r1',name:'花生',targets:['peanut'],kind:'allergy' as const,status:'confirmed' as const,scope:'self' as const,original:'花生'},{id:'r2',name:'西红柿',targets:['tomato'],kind:'avoid' as const,status:'confirmed' as const,scope:'self' as const,original:'西红柿'}]};
    await accounts.save(alice,keySave.json().version,{favorites:[],defaults});
    const response=await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:{...request,apiKey:'sk-wrong-browser-test-only-123456789'}});assert.equal(response.statusCode,200);const data=response.json();assert.equal(calls,1);
    assert.deepEqual(data.assessment.suggestions.map((item:any)=>item.foodName),['牛肉']);assert(!/花生|番茄/.test(data.message.content));assert(!response.body.includes(key));
    const snapshot=await accounts.load(alice);assert.deepEqual(snapshot.value.defaults?.healthProfile?.conditions,['测试健康关注']);assert.deepEqual(snapshot.value.defaults?.healthProfile?.goals,['增肌']);assert.deepEqual(snapshot.value.defaults?.healthProfile?.suggestions.map(item=>item.foodName),['牛肉']);
    assert.equal(snapshot.value.defaults?.aiExcludedFoods,undefined);assert.equal(snapshot.value.defaults?.restrictions.length,2);
    const staleProfile=snapshot.value.defaults!.healthProfile!;const cleared=await accounts.save(alice,snapshot.version,{favorites:[],defaults:{...snapshot.value.defaults!,healthProfile:undefined}});
    await assert.rejects(accounts.saveHealthGuidance(alice,staleProfile,key,staleProfile),/档案/);
    await accounts.setHealthKey(alice,cleared.version,null);assert.equal((await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:{...request,operationId:crypto.randomUUID()}})).json().error.code,'CHAT_KEY_REQUIRED');assert.equal(calls,1);
  }finally{await app.close();await db.close();}
});

test('去重覆盖别名和建议文字，不影响新食材',()=>{
  const suggestions=['番茄','花生','牛肉'].map(foodName=>({foodName,direction:'prefer' as const,reason:'测试',conditions:'',matchable:true}));
  assert.deepEqual(withoutExistingRestrictions(suggestions,['西红柿','花生'],constructedContent).map(item=>item.foodName),['牛肉']);
  assert.equal(withoutRepeatedFoodText('番茄适合。新的建议。花生需避开。',['西红柿','花生'],constructedContent),'新的建议。');
});


test('并列及括号示例拆成具体食材，未知项目保持参考，不凭类别猜组成',()=>{
  const items=expandFoodSuggestions([{foodName:'新鲜蔬菜（如西红柿、菠菜）',direction:'prefer',reason:'构造说明',conditions:'',matchable:false},{foodName:'鸡蛋、火星草',direction:'limit',reason:'构造说明',conditions:'',matchable:false}],constructedContent);
  assert.deepEqual(items.map(item=>item.foodName),['西红柿','菠菜','鸡蛋','火星草']);assert.deepEqual(items.map(item=>item.matchable),[true,true,true,false]);
});

test('已接受三类选择随账号保留，旧普通偏好写入不擦除，AI从服务器读取',async()=>{
  const {db,accounts}=await fixture();let received:any;
  const app=await createApp({accounts,healthChatFetch:async(_url,init)=>{received=JSON.parse(String(init?.body));return Response.json({id:'accepted-prefs-proof-123456',model:'deepseek-flash',usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20},choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'构造说明',stage:'clarify',profile:{conditions:[],goals:[],notes:''},suggestions:[]})}}]});}});
  try{
    const alice=await user(accounts,'prefs-alice');const configured=await accounts.setHealthKey(alice,0,key);const preferences={preferred:['西红柿'],limited:['猪肉'],excluded:['花生','火星草']};
    const saved=await accounts.save(alice,configured.version,{favorites:[],defaults:{...defaultMeal(),aiFoodPreferences:preferences}});assert.deepEqual(saved.value.defaults?.aiFoodPreferences,preferences);
    const old=await accounts.save(alice,saved.version,{favorites:[],defaults:{...defaultMeal(),flavor:'微辣'}});assert.deepEqual(old.value.defaults?.aiFoodPreferences,preferences);
    const session=await app.inject('/api/v1/auth/session');const headers={cookie:`${String(session.headers['set-cookie']).split(';')[0]}; ${accounts.cookie(alice).split(';')[0]}`,origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
    const response=await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:{operationId:crypto.randomUUID(),diseases:[],messages:[{role:'user',content:'读取已有食材选择'}]}});assert.equal(response.statusCode,200);assert(JSON.stringify(received.messages).includes('aiFoodPreferences'));assert(JSON.stringify(received.messages).includes('火星草'));assert(!response.body.includes(key));
  }finally{await app.close();await db.close();}
});

test('清除档案后不回退到旧客户端疾病/备注，跨设备旧对话不带回已删信息',async()=>{
  const {db,accounts}=await fixture();let sent:any;
  const app=await createApp({accounts,healthChatFetch:async(_url,init)=>{sent=JSON.parse(String(init?.body));return Response.json({id:'cleared-profile-proof-123456',model:'deepseek-flash',usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30},choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'可继续讨论做法。',stage:'clarify',profile:{conditions:[],goals:[],notes:''},suggestions:[]})}}]});}});
  try{
    const alice=await user(accounts,'cleared-alice');await accounts.setHealthKey(alice,0,key);
    const session=await app.inject('/api/v1/auth/session');const headers={cookie:`${String(session.headers['set-cookie']).split(';')[0]}; ${accounts.cookie(alice).split(';')[0]}`,origin:'http://localhost:80','x-csrf-token':session.json().csrfToken};
    const response=await app.inject({method:'POST',url:'/api/v1/health/chat',headers,payload:{operationId:crypto.randomUUID(),diseases:['旧高血压'],profile:{conditions:['旧高血压'],goals:[],notes:'旧血压摘要'},messages:[{role:'user',content:'我有旧高血压'},{role:'assistant',content:'旧血压建议'},{role:'user',content:'继续说说做法'}]}});
    assert.equal(response.statusCode,200);assert(!JSON.stringify(sent).includes('旧高血压'));assert(!JSON.stringify(sent).includes('旧血压摘要'));assert.equal(sent.messages.filter((item:any)=>item.role!=='system').length,1);
  }finally{await app.close();await db.close();}
});

test('旧加密记录只剩风湿病时，不把已删高血压的全局建议错归为风湿病建议',async()=>{
  const {db,accounts,options}=await fixture();try{
    const alice=await user(accounts,'legacy-scope');await accounts.setHealthKey(alice,0,key);
    const legacy={favorites:[],defaults:{...defaultMeal(),healthProfile:{conditions:['风湿病'],goals:[],notes:'旧高血压摘要',updatedAt:new Date().toISOString(),suggestions:[{foodName:'鸡蛋',direction:'avoid',reason:'旧高血压测试建议',conditions:'',matchable:true}]},aiFoodPreferences:{preferred:[],limited:[],excluded:['鸡蛋']}},healthApiKey:key};
    const envelope=seal(legacy,options.profileKey,alice.userId,'account-state',options.keyVersion);
    await db.query('UPDATE shiwei_account_state SET envelope=$1 WHERE owner_id=$2',[envelope,alice.userId]);
    const snapshot=await accounts.load(alice);assert.deepEqual(snapshot.value.defaults?.healthProfile?.conditions,['风湿病']);
    assert.equal(snapshot.value.defaults?.healthProfile?.notes,'');assert.deepEqual(snapshot.value.defaults?.healthProfile?.suggestions,[]);
    assert.deepEqual(snapshot.value.defaults?.healthProfile?.topics?.[0].accepted,{preferred:[],limited:[],excluded:[]});
    assert.deepEqual(snapshot.value.defaults?.aiFoodPreferences,{preferred:[],limited:[],excluded:[]});
    assert(!JSON.stringify((await accounts.healthKey(alice)).profile).includes('高血压'));assert.equal((await accounts.healthKey(alice)).apiKey,key);
  }finally{await db.close();}
});
