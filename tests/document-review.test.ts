import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('B线表格/OCR/证据门禁：合并关系、单位基准、分片映射、歧义拒收和禁止伪造批准', t => {
 const python=process.env.DOCUMENT_PARSER_PYTHON??'python';
 const result=spawnSync(python,['-B','-X','utf8','tests/document_review_test.py'],{encoding:'utf8',timeout:60000,windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
 if(result.error&&(result.error as NodeJS.ErrnoException).code==='ENOENT'){t.skip('Python unavailable; run pinned document review suite');return;}
 assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/Ran 15 tests/);
 assert.doesNotMatch(result.stderr,/OK \(skipped=/,'Pinned review dependencies required; Python subtest skips are not a complete check');
});
