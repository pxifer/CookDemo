import { createHash } from 'node:crypto';
import type { Database } from './db';
import { open,type Envelope } from './crypto';

export const businessTables=['shiwei_gallery_releases','shiwei_account_state','shiwei_account_sessions','shiwei_ai_chat_operations','shiwei_recommendation_tasks','shiwei_account_tombstones'] as const;
type Table=typeof businessTables[number];
type Row=Record<string,unknown>;
export interface JournalHead {sequence:number;hash:string;ancestors:Record<string,string>;revokedUsers:string[]}
export interface BusinessSnapshot {
  kind:'cloudbase-business-snapshot';version:1;sourceDatabase:string;createdAt:string;schemaHash:string;
  identityExport:{id:string;hash:string};assets:{path:string;hash:string}[];journal:{sequence:number;hash:string};
  tables:Partial<Record<Table,Row[]>>;
}
export const recoveryHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fail(code:string):never{throw Error(code);}
function validateHead(head:JournalHead){
  if(!head||!Number.isSafeInteger(head.sequence)||head.sequence<0||!/^[a-f0-9]{64}$/.test(head.hash)||!head.ancestors||Object.values(head.ancestors).some(hash=>!/^[a-f0-9]{64}$/.test(hash))||!Array.isArray(head.revokedUsers)||head.revokedUsers.some(uid=>typeof uid!=='string'||!uid||uid.length>256))fail('BUSINESS_JOURNAL_HEAD_INVALID');
  return head;
}
export function validateBusinessSnapshot(raw:unknown):BusinessSnapshot{
  const value=raw as BusinessSnapshot;
  if(!value||value.kind!=='cloudbase-business-snapshot'||value.version!==1||!value.tables||!Array.isArray(value.tables.shiwei_account_state)||!Array.isArray(value.tables.shiwei_gallery_releases)
    ||!/^[a-f0-9]{64}$/.test(value.schemaHash)||!value.identityExport||!/^[a-f0-9]{64}$/.test(value.identityExport.hash)||!value.journal||!Number.isSafeInteger(value.journal.sequence)||value.journal.sequence<0||!/^[a-f0-9]{64}$/.test(value.journal.hash)
    ||!Array.isArray(value.assets)||value.assets.some(asset=>!/^\/assets\/recipes\/[a-zA-Z0-9_.-]+\.(png|webp)$/.test(asset.path)||!/^[a-f0-9]{64}$/.test(asset.hash))
    ||Object.entries(value.tables).some(([name,rows])=>!businessTables.includes(name as Table)||!Array.isArray(rows)||rows.some(row=>!row||typeof row!=='object'||Array.isArray(row))))fail('BUSINESS_SNAPSHOT_INVALID');
  return value;
}
async function schemaHash(db:Database){
  const result=await db.query<Row>(`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position`,[[...businessTables]]);
  const policies=await db.query<Row>(`SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1::text[]) ORDER BY tablename,policyname`,[[...businessTables]]);
  const permissions=await db.query<Row>(`SELECT relname,relrowsecurity,relforcerowsecurity,relacl::text AS acl FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[]) ORDER BY relname`,[[...businessTables]]);
  const functions=await db.query<Row>(`SELECT proname,pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND left(proname,7)='shiwei_' ORDER BY proname,pg_get_function_identity_arguments(oid)`);
  return recoveryHash({columns:result.rows,policies:policies.rows,permissions:permissions.rows,functions:functions.rows});
}
export async function captureBusinessSnapshot(db:Database,input:{sourceDatabase:string;identityExport:BusinessSnapshot['identityExport'];assets:BusinessSnapshot['assets'];journal:JournalHead}):Promise<BusinessSnapshot>{
  validateHead(input.journal);
  if(!/^[a-z][a-z0-9_]{0,62}$/.test(input.sourceDatabase)||!/^[a-f0-9]{64}$/.test(input.identityExport.hash)||!Number.isSafeInteger(input.journal.sequence))fail('BUSINESS_BACKUP_CONFIGURATION');
  const work=async(session:Database)=>{
    await session.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try{
      const privilege=await session.query<{bypass:boolean}>('SELECT rolsuper OR rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user');
      if(privilege.rows[0]?.bypass!==true)fail('BUSINESS_BACKUP_REQUIRES_FULL_READ_ROLE');
      const unknown=await session.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='public' AND left(tablename,7)='shiwei_'");
      if(unknown.rows.some(row=>!businessTables.includes(row.tablename as Table)))fail('BUSINESS_BACKUP_UNCOVERED_TABLE');
      const tables:BusinessSnapshot['tables']={};
      for(const table of businessTables){
        const exists=await session.query<{present:boolean}>('SELECT to_regclass($1) IS NOT NULL AS present',[`public.${table}`]);
        if(exists.rows[0]?.present)tables[table]=(await session.query<Row>(`SELECT * FROM public.${table}`)).rows;
      }
      if(!tables.shiwei_account_state||!tables.shiwei_gallery_releases)fail('BUSINESS_BACKUP_REQUIRED_TABLE_MISSING');
      const snapshot:BusinessSnapshot={kind:'cloudbase-business-snapshot',version:1,sourceDatabase:input.sourceDatabase,createdAt:new Date().toISOString(),schemaHash:await schemaHash(session),identityExport:input.identityExport,assets:input.assets,journal:{sequence:input.journal.sequence,hash:input.journal.hash},tables};
      if(Buffer.byteLength(JSON.stringify(snapshot))>64*1024*1024)fail('BUSINESS_BACKUP_TOO_LARGE');
      if(tables.shiwei_account_tombstones?.some(row=>!input.journal.revokedUsers.includes(String(row.owner_id))))fail('BUSINESS_BACKUP_JOURNAL_BEHIND_DATABASE');
      validateBusinessSnapshot(snapshot);await session.exec('COMMIT');return snapshot;
    }catch(error){await session.exec('ROLLBACK');throw error;}
  };
  return db.withSession?db.withSession(work):work(db);
}
export interface RecoveryDependencies {
  // These are trusted adapters, never flags supplied by a user-facing API.
  latestVerifiedJournal():Promise<JournalHead>;
  verifyIdentityExport(reference:BusinessSnapshot['identityExport'],owners:string[]):Promise<boolean>;
  verifyAssets(assets:BusinessSnapshot['assets']):Promise<boolean>;
  profileKey(version:string):Promise<Buffer|undefined>;
}
export async function restoreBusinessSnapshot(db:Database,snapshot:BusinessSnapshot,targetDatabase:string,deps:RecoveryDependencies){
  validateBusinessSnapshot(snapshot);
  if(snapshot.kind!=='cloudbase-business-snapshot'||snapshot.version!==1||targetDatabase===snapshot.sourceDatabase||!/^shiwei_[a-z0-9_]*restore_[a-z0-9_]+$/.test(targetDatabase))fail('BUSINESS_RESTORE_TARGET_REJECTED');
  if(Object.keys(snapshot.tables).some(table=>!businessTables.includes(table as Table)))fail('BUSINESS_RESTORE_UNKNOWN_TABLE');
  if(await schemaHash(db)!==snapshot.schemaHash)fail('BUSINESS_RESTORE_SCHEMA_MISMATCH');
  const latest=validateHead(await deps.latestVerifiedJournal());
  if(latest.sequence<snapshot.journal.sequence||(latest.sequence===snapshot.journal.sequence?latest.hash!==snapshot.journal.hash:latest.ancestors[String(snapshot.journal.sequence)]!==snapshot.journal.hash))fail('BUSINESS_RESTORE_JOURNAL_ROLLBACK');
  const revoked=new Set([...latest.revokedUsers,...(snapshot.tables.shiwei_account_tombstones??[]).map(row=>String(row.owner_id))]),accounts=snapshot.tables.shiwei_account_state??[];
  const owners=accounts.map(row=>String(row.owner_id)).filter(uid=>!revoked.has(uid));
  if(!await deps.verifyIdentityExport(snapshot.identityExport,owners))fail('BUSINESS_RESTORE_IDENTITY_UNVERIFIED');
  if(!await deps.verifyAssets(snapshot.assets))fail('BUSINESS_RESTORE_ASSETS_UNVERIFIED');
  for(const row of accounts){
    if(!row.envelope||revoked.has(String(row.owner_id)))continue;
    const envelope=row.envelope as Envelope,key=await deps.profileKey(envelope.keyVersion);
    if(!key)fail('BUSINESS_RESTORE_PROFILE_KEY_MISSING');
    try{open(envelope,key,String(row.owner_id),'account-state');}catch{fail('BUSINESS_RESTORE_PROFILE_DECRYPT_FAILED');}
  }
  const work=async(session:Database)=>{
    await session.exec('BEGIN');
    try{
      const privilege=await session.query<{bypass:boolean}>('SELECT rolsuper OR rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user');
      if(privilege.rows[0]?.bypass!==true)fail('BUSINESS_RESTORE_REQUIRES_FULL_READ_ROLE');
      for(const table of Object.keys(snapshot.tables) as Table[])await session.exec(`LOCK TABLE public.${table} IN ACCESS EXCLUSIVE MODE`);
      if(await schemaHash(session)!==snapshot.schemaHash)fail('BUSINESS_RESTORE_SCHEMA_MISMATCH');
      for(const table of Object.keys(snapshot.tables) as Table[]){const result=await session.query<{count:number}>(`SELECT count(*)::int AS count FROM public.${table}`);if(result.rows[0].count!==0)fail('BUSINESS_RESTORE_TARGET_NOT_EMPTY');}
      for(const table of businessTables){
        const original=snapshot.tables[table];if(!original)continue;
        // Old sessions and meal task state never become live again after restore.
        let rows:Row[]=table==='shiwei_account_sessions'||table==='shiwei_recommendation_tasks'?[]:structuredClone(original);
        if(table==='shiwei_account_state')rows=rows.filter(row=>!revoked.has(String(row.owner_id)));
        if(table==='shiwei_account_tombstones'){
          const present=new Set(rows.map(row=>String(row.owner_id)));
          rows.push(...[...revoked].filter(uid=>!present.has(uid)).map(owner_id=>({owner_id,operation_id:crypto.randomUUID(),state:'completed',created_at:new Date().toISOString(),completed_at:new Date().toISOString()})));
        }
        if(rows.length)await session.query(`INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(NULL::public.${table},$1::jsonb)`,[JSON.stringify(rows)]);
      }
      if(revoked.size&&!snapshot.tables.shiwei_account_tombstones)fail('BUSINESS_RESTORE_TOMBSTONE_SCHEMA_MISSING');
      const finalHead=validateHead(await deps.latestVerifiedJournal());
      if(finalHead.sequence!==latest.sequence||finalHead.hash!==latest.hash)fail('BUSINESS_RESTORE_JOURNAL_CHANGED');
      await session.exec('COMMIT');
      return {state:'isolated_data_restored',identitiesVerified:true,profileKeysVerified:true,sessionsRestored:0,revocationSequence:latest.sequence,revokedAccountsSuppressed:accounts.filter(row=>revoked.has(String(row.owner_id))).length,serviceOpened:false};
    }catch(error){await session.exec('ROLLBACK');throw error;}
  };
  return db.withSession?db.withSession(work):work(db);
}
