import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {localTestEnvironment} from './local-test-guard.mjs';
const env=localTestEnvironment(process.env,pathToFileURL(resolve('scripts/local-test-guard.mjs')).href);
env.ACCEPTANCE_DIR='.local-data/acceptance-input';
const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.ingredient-photo.config.ts'],{cwd:resolve('.'),env,stdio:'inherit',shell:false,windowsHide:true});
child.on('error',()=>{process.exitCode=1;});child.on('close',code=>{process.exitCode=code??1;});
