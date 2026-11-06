import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('B线定位修复：下标/单元格顺序、无竖线列界与历史偏移加双侧上下文', t => {
 const python=process.env.DOCUMENT_PARSER_PYTHON??'python';
 const result=spawnSync(python,['-B','-X','utf8','tests/document_resolution_test.py'],{encoding:'utf8',timeout:60000,windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
 if(result.error&&(result.error as NodeJS.ErrnoException).code==='ENOENT'){t.skip('Python unavailable; run pinned resolution suite');return;}
 assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/Ran 10 tests/);
});
