import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture } from './registration-fixture';
import { captureBusinessSnapshot,restoreBusinessSnapshot,recoveryHash,type JournalHead } from '../backend/src/business-recovery';
import { writeBusinessArchive,readBusinessArchive } from '../scripts/lib/business-archive';
import type { Database } from '../backend/src/db';
import { seal,open } from '../backend/src/crypto';

async function database(){
  const f=await fixture();await f.db.exec(await readFile('deployment/db/gallery-http-release.sql','utf8'));await f.db.exec(await readFile('deployment/db/account-lifecycle.sql','utf8'));
  const db:Database={query:(sql,params)=>f.db.query(sql,params),exec:async sql=>{await f.db.exec(sql);},close:()=>f.db.close()};return {f,db};
}
test('带真实业务行的加密快照恢复：资料可解密，最新注销不复活，旧会话不恢复且不开服务',async()=>{
  const source=await database(),target=await database(),dir=await mkdtemp(join(tmpdir(),'shiwei-business-restore-'));
  try{
    const profileKey=randomBytes(32),archiveKey=randomBytes(32);
    for(const uid of ['kept-owner','deleted-after-backup'])await source.db.query('INSERT INTO shiwei_account_state(owner_id,envelope,password_initialized) VALUES($1,$2,true)',[uid,seal({favorites:[{recipeId:'recipe',variantId:'variant'}],healthApiKey:'sk-constructed-private-value'},profileKey,uid,'account-state','test-key-v1')]);
    await source.db.query("INSERT INTO shiwei_account_sessions VALUES('kept-owner',repeat('a',64),now()+interval '10 minutes')");
    const first:JournalHead={sequence:1,hash:'a'.repeat(64),ancestors:{},revokedUsers:[]};
    const snapshot=await captureBusinessSnapshot(source.db,{sourceDatabase:'shiwei_fixture_source',journal:first,identityExport:{id:'synthetic-identity-export',hash:recoveryHash(['kept-owner','deleted-after-backup'])},assets:[]});
    const archive=join(dir,'business.swbk');await writeBusinessArchive(snapshot,archive,archiveKey,['f'.repeat(64)]);
    const raw=await readFile(archive);assert(!raw.includes(Buffer.from('sk-constructed-private-value')));
    const recovered=await readBusinessArchive(archive,join(dir,'authenticated.json'),archiveKey);assert.equal(recovered.metadata.scope,'business-snapshot');
    const latest:JournalHead={sequence:2,hash:'b'.repeat(64),ancestors:{1:first.hash},revokedUsers:['deleted-after-backup']};
    const result=await restoreBusinessSnapshot(target.db,recovered.snapshot,'shiwei_test_restore_isolated',{latestVerifiedJournal:async()=>latest,verifyAssets:async()=>true,verifyIdentityExport:async(_ref,owners)=>{assert.deepEqual(owners,['kept-owner']);return true;},profileKey:async()=>profileKey});
    assert.equal(result.sessionsRestored,0);assert.equal(result.serviceOpened,false);assert.equal(result.revokedAccountsSuppressed,1);
    const accounts=(await target.db.query<{owner_id:string;envelope:any}>('SELECT * FROM shiwei_account_state')).rows;assert.deepEqual(accounts.map(r=>r.owner_id),['kept-owner']);
    assert.equal((open(accounts[0].envelope,profileKey,'kept-owner','account-state') as any).healthApiKey,'sk-constructed-private-value');
    assert.equal((await target.db.query('SELECT * FROM shiwei_account_sessions')).rows.length,0);assert.equal((await target.db.query('SELECT * FROM shiwei_account_tombstones')).rows.length,1);
  }finally{await source.db.close();await target.db.close();await rm(dir,{recursive:true,force:true});}
});
test('恢复拒绝旧撤销水位、身份未核验、缺密钥、非空目标和执行中水位变化',async()=>{
  const source=await database(),target=await database();
  try{
    const key=randomBytes(32),head:JournalHead={sequence:2,hash:'a'.repeat(64),ancestors:{},revokedUsers:[]};
    await source.db.query('INSERT INTO shiwei_account_state(owner_id,envelope) VALUES($1,$2)',['u',seal({},key,'u','account-state','key-v1')]);
    const snapshot=await captureBusinessSnapshot(source.db,{sourceDatabase:'shiwei_fixture_source',journal:head,identityExport:{id:'fixture',hash:'b'.repeat(64)},assets:[]});
    const deps={latestVerifiedJournal:async()=>head,verifyIdentityExport:async()=>true,verifyAssets:async()=>true,profileKey:async()=>key};
    const restore=(patch:Partial<typeof deps>)=>restoreBusinessSnapshot(target.db,snapshot,'shiwei_test_restore_isolated',{...deps,...patch});
    await assert.rejects(restore({latestVerifiedJournal:async()=>({...head,sequence:1})}),/JOURNAL_ROLLBACK/);
    await assert.rejects(restore({verifyIdentityExport:async()=>false}),/IDENTITY_UNVERIFIED/);
    await assert.rejects(restore({profileKey:async()=>undefined as any}),/PROFILE_KEY_MISSING/);
    let reads=0;await assert.rejects(restore({latestVerifiedJournal:async()=>++reads===1?head:{...head,sequence:3,hash:'c'.repeat(64)}}),/JOURNAL_CHANGED/);
    assert.equal((await target.db.query('SELECT * FROM shiwei_account_state')).rows.length,0,'水位变化时恢复事务回滚');
    await target.db.exec('ALTER TABLE shiwei_account_state DISABLE ROW LEVEL SECURITY');await assert.rejects(restore({}),/SCHEMA_MISMATCH/);await target.db.exec('ALTER TABLE shiwei_account_state ENABLE ROW LEVEL SECURITY');
    await target.db.query("INSERT INTO shiwei_account_state(owner_id) VALUES('existing')");await assert.rejects(restore({}),/TARGET_NOT_EMPTY/);
  }finally{await source.db.close();await target.db.close();}
});
