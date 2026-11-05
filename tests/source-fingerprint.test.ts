import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,relative,resolve} from 'node:path';
import {fileTree,sha256,sourceHashes} from '../scripts/lib/source-fingerprint';
test('验收指纹覆盖运行时静态JSON依赖，包括菜谱步骤、成分审查和图片映射',async()=>{
  const hashes=await sourceHashes(),files=(await Promise.all(['frontend/src','backend/src','shared','deployment/cloudbase'].map(fileTree))).flat().filter(path=>/\.tsx?$/.test(path));
  const dependencies=new Set<string>();
  for(const file of files){
    const source=await readFile(file,'utf8');
    for(const match of source.matchAll(/(?:from|import)\s*['"](\.[^'"]+\.json)['"]/g))dependencies.add(relative(process.cwd(),resolve(dirname(file),match[1])).replaceAll('\\','/'));
  }
  assert(dependencies.size>=6,'必须发现已知运行时依赖，避免空扫描冒充覆盖');
  for(const path of dependencies){assert(Object.hasOwn(hashes,path),`运行时JSON没有纳入验收指纹：${path}`);assert.equal(hashes[path],sha256(await readFile(path)),path);}
});
