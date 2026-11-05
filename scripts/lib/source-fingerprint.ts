import { readdir,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
export const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export async function fileTree(dir:string):Promise<string[]>{
  const found:string[]=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name==='__pycache__'||entry.name.endsWith('.pyc'))continue;
    const path=join(dir,entry.name);
    if(entry.isDirectory())found.push(...await fileTree(path));else if(entry.isFile())found.push(path);
  }
  return found.sort();
}
export async function sourceHashes(){
  const paths=[...(await Promise.all(['frontend/src','backend/src','backend/rag-runtime','shared','datasets','scripts','deployment','tests'].map(fileTree))).flat(),'package.json','package-lock.json','tsconfig.json','tsconfig.acceptance.json','vite.config.ts','Dockerfile','.dockerignore',...(await readdir('.')).filter(name=>/^playwright.*\.config\.ts$/.test(name))].sort();
  return Object.fromEntries(await Promise.all(paths.map(async path=>[path.replaceAll('\\','/'),sha256(await readFile(path))])));
}
export const sourceFingerprint=(hashes:Record<string,string>)=>sha256(Buffer.from(JSON.stringify(hashes)));
export async function treeHashes(dir:string){return Object.fromEntries(await Promise.all((await fileTree(dir)).map(async path=>[path.replaceAll('\\','/'),sha256(await readFile(path))])));}
