import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {localTestEnvironment} from './local-test-guard.mjs';
const env=localTestEnvironment(process.env,pathToFileURL(resolve('scripts/local-test-guard.mjs')).href);
const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.recipe1000.config.ts'],{cwd:resolve('.'),env,stdio:'inherit',windowsHide:true,shell:false});
child.on('close',code=>{process.exitCode=code??1;});child.on('error',()=>{process.exitCode=1;});
