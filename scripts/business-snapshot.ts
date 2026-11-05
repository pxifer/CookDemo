import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createHash,createHmac,timingSafeEqual } from 'node:crypto';
import { connectDatabase } from '../backend/src/db';
import { captureBusinessSnapshot,restoreBusinessSnapshot,recoveryHash,type JournalHead } from '../backend/src/business-recovery';
import { writeBusinessArchive,readBusinessArchive } from './lib/business-archive';

interface Configuration {databaseUrlFile:string;databaseCaFile?:string;backupKeyFile:string;authorityKeyFile:string;journalHeadFile:string;identityAttestationFile:string;assetManifestFile:string;assetRoot:string;migrationChecksums:string[];archive:string;profileKeyFiles:Record<string,string>}
async function main(){
const [mode,configPath]=process.argv.slice(2);
if(!['backup','restore'].includes(mode)||!configPath)throw Error('BUSINESS_SNAPSHOT_ARGUMENTS: backup|restore <protected-config-path>');
const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const config:Configuration=await read(configPath);
if(!['databaseUrlFile','backupKeyFile','authorityKeyFile','journalHeadFile','identityAttestationFile','assetManifestFile','archive'].every(key=>typeof config[key as keyof Configuration]==='string'&&config[key as keyof Configuration]))throw Error('BUSINESS_SNAPSHOT_CONFIGURATION_REQUIRED');
if(!config.profileKeyFiles||typeof config.profileKeyFiles!=='object'||typeof config.assetRoot!=='string'||!Array.isArray(config.migrationChecksums)||!config.migrationChecksums.length||config.migrationChecksums.some(hash=>!/^[a-f0-9]{64}$/.test(hash)))throw Error('BUSINESS_SNAPSHOT_CONFIGURATION_REQUIRED');
async function key(path:string){const encoded=(await readFile(path,'utf8')).trim(),value=Buffer.from(encoded,'base64');if(value.length!==32||value.toString('base64')!==encoded)throw Error('BUSINESS_SNAPSHOT_KEY_INVALID');return value;}
const archiveKey=await key(config.backupKeyFile),authorityKey=await key(config.authorityKeyFile);
if(archiveKey.equals(authorityKey))throw Error('BUSINESS_SNAPSHOT_SEPARATE_AUTHORITY_KEY_REQUIRED');
async function signed<T>(path:string,purpose:string):Promise<T>{
  const value=await read(path),actual=Buffer.from(String(value.signature??''),'hex'),expected=createHmac('sha256',authorityKey).update(purpose).update(JSON.stringify(value.payload)).digest();
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('BUSINESS_SNAPSHOT_AUTHORITY_UNVERIFIED');return value.payload as T;
}
const latestHead=()=>signed<JournalHead>(config.journalHeadFile,'revocation-head-v1');
const identity=await signed<{id:string;exportHash:string;owners:string[];verifiedAt:string}>(config.identityAttestationFile,'identity-attestation-v1');
if(!/^[a-f0-9]{64}$/.test(identity.exportHash)||!Array.isArray(identity.owners)||Date.now()-Date.parse(identity.verifiedAt)>15*60*1000||Date.parse(identity.verifiedAt)>Date.now()+60000||!Number.isFinite(Date.parse(identity.verifiedAt)))throw Error('BUSINESS_SNAPSHOT_IDENTITY_ATTESTATION_STALE');
const assets:{path:string;hash:string}[]=await read(config.assetManifestFile);
const url=(await readFile(config.databaseUrlFile,'utf8')).trim(),databaseUrl=new URL(url),database=databaseUrl.pathname.slice(1);
if(mode==='restore'&&!/^shiwei_[a-z0-9_]*restore_[a-z0-9_]+$/.test(database))throw Error('BUSINESS_RESTORE_TARGET_REJECTED');
if(!['127.0.0.1','localhost'].includes(databaseUrl.hostname)&&(!config.databaseCaFile||databaseUrl.searchParams.get('sslmode')!=='verify-full'))throw Error('BUSINESS_SNAPSHOT_REMOTE_TLS_REQUIRED');
const db=await connectDatabase(url,{max:1,queryTimeoutMs:30000,...(config.databaseCaFile?{ca:await readFile(config.databaseCaFile,'utf8')}:{})});
const out=resolve(process.env.BUSINESS_RECOVERY_DIR??`artifacts/acceptance/business-recovery-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(out,{recursive:true});
try{
  const actual=(await db.query<{name:string}>('SELECT current_database() AS name')).rows[0].name;if(actual!==database)throw Error('BUSINESS_SNAPSHOT_DATABASE_MISMATCH');
  const reference={id:identity.id,hash:identity.exportHash};
  if(mode==='backup'){
    const snapshot=await captureBusinessSnapshot(db,{sourceDatabase:database,journal:await latestHead(),identityExport:reference,assets});
    const receipt=await writeBusinessArchive(snapshot,config.archive,archiveKey,config.migrationChecksums);
    await writeFile(join(out,'backup.json'),JSON.stringify({...receipt,tableCounts:Object.fromEntries(Object.entries(snapshot.tables).map(([name,rows])=>[name,rows?.length])),identityEvidence:'supplied_signed_attestation',fullRecoveryAccepted:false},null,2)+'\n');
    console.log(JSON.stringify({state:'encrypted_business_snapshot_created',report:join(out,'backup.json'),fullRecoveryAccepted:false}));
  }else{
    const {snapshot}=await readBusinessArchive(config.archive,resolve(config.archive+'.authenticated-'+crypto.randomUUID()+'.json'),archiveKey);
    const receipt=await restoreBusinessSnapshot(db,snapshot,database,{latestVerifiedJournal:latestHead,
      verifyIdentityExport:async(ref,owners)=>ref.id===reference.id&&ref.hash===reference.hash&&owners.every(uid=>identity.owners.includes(uid)),
      verifyAssets:async manifest=>{for(const asset of manifest){const root=resolve(config.assetRoot),path=resolve(root,'.'+asset.path);if(!path.startsWith(root+'/')&&!path.startsWith(root+'\\'))return false;if(createHash('sha256').update(await readFile(path)).digest('hex')!==asset.hash)return false;}return true;},
      profileKey:async version=>config.profileKeyFiles[version]?key(config.profileKeyFiles[version]):undefined});
    await writeFile(join(out,'restore.json'),JSON.stringify({...receipt,identityEvidence:'supplied_signed_attestation',fullRecoveryAccepted:false},null,2)+'\n');
    console.log(JSON.stringify({state:receipt.state,report:join(out,'restore.json'),serviceOpened:false,fullRecoveryAccepted:false}));
  }
}catch(error){console.error(/^BUSINESS_[A-Z_]+$/.test((error as Error).message)?(error as Error).message:'BUSINESS_SNAPSHOT_FAILED');process.exitCode=1;}finally{archiveKey.fill(0);authorityKey.fill(0);await db.close();}

}
main().catch(error=>{console.error(/^BUSINESS_[A-Z_]+$/.test(error?.message)?error.message:'BUSINESS_SNAPSHOT_FAILED');process.exitCode=1;});
