import { Readable } from 'node:stream';
import { readFile,unlink } from 'node:fs/promises';
import { encryptBackup,decryptBackup } from './backup-archive';
import { recoveryHash,validateBusinessSnapshot,type BusinessSnapshot } from '../../backend/src/business-recovery';
export async function writeBusinessArchive(snapshot:BusinessSnapshot,destination:string,key:Buffer,migrationChecksums:string[]){
  validateBusinessSnapshot(snapshot);
  return encryptBackup(Readable.from([Buffer.from(JSON.stringify(snapshot))]),destination,key,{scope:'business-snapshot',format:'business-json-v1',database:snapshot.sourceDatabase,createdAt:snapshot.createdAt,migrationChecksums,manifestHash:recoveryHash(snapshot)});
}
export async function readBusinessArchive(source:string,temporary:string,key:Buffer){
  let created=false;
  try{
    const metadata=await decryptBackup(source,temporary,key);created=true;
    if(metadata.scope!=='business-snapshot'||metadata.format!=='business-json-v1')throw Error('BUSINESS_ARCHIVE_SCOPE_MISMATCH');
    const raw=await readFile(temporary);if(raw.length>64*1024*1024)throw Error('BUSINESS_ARCHIVE_TOO_LARGE');
    const snapshot=validateBusinessSnapshot(JSON.parse(raw.toString()));
    if(metadata.manifestHash!==recoveryHash(snapshot))throw Error('BUSINESS_ARCHIVE_MANIFEST_MISMATCH');
    return {snapshot,metadata};
  }finally{if(created)await unlink(temporary);}
}
