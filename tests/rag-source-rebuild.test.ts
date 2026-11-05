import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('离线原件重建：原hash、重复构建、路径隔离、拒绝覆盖、数字/否定及可视资料待审',t=>{
 const python=process.env.RAG_PARSER_PYTHON??'python';
 const result=spawnSync(python,['-B','-X','utf8','tests/rag_source_rebuild_test.py'],{encoding:'utf8',timeout:30000,windowsHide:true,
  env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
 if(result.error&&(result.error as NodeJS.ErrnoException).code==='ENOENT'){t.skip('Python 3.11 unavailable; run pinned parser separately');return;}
 assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/Ran 6 tests/);
});
