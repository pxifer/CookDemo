import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('B线文档解析：正文/关键限定保真、双栏与整宽表格、可逆去噪、OCR不伪造',t=>{
 const python=process.env.DOCUMENT_PARSER_PYTHON??'python';
 const result=spawnSync(python,['-B','-X','utf8','tests/document_parser_test.py'],{encoding:'utf8',timeout:60000,windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
 if(result.error&&(result.error as NodeJS.ErrnoException).code==='ENOENT'){t.skip('Python unavailable; run document-parser suite using pinned runtime');return;}
 assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/Ran 16 tests/);
 assert.doesNotMatch(result.stderr,/OK \(skipped=/,'Pinned parser dependencies required; Python subtest skips are not a complete check');
});
