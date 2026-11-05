import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { localTestEnvironment } from './local-test-guard.mjs';
import { validateLocalTestConfig } from './lib/local-test-config';
import { probeDocker } from './lib/acceptance-environment';

const tsx='node_modules/tsx/dist/cli.mjs',pw='node_modules/@playwright/test/cli.js';
const task=process.argv[2],extra=process.argv.slice(3);
const configs:Record<string,string>={health:'playwright.health-chat.config.ts','food-guidance':'playwright.food-guidance.config.ts',registration:'playwright.registration.config.ts',business:'playwright.business.config.ts',ui:'playwright.ui.config.ts',resume:'playwright.resume.config.ts'};
const pg:Record<string,string>={structure:'postgres.integration.ts',business:'business-postgres.integration.ts',community:'community-local-postgres.integration.ts',health:'health-chat-postgres.integration.ts',cloudbase:'cloudbase-migrations.integration.ts'};
const flags:Record<string,string>={structure:'RUN_POSTGRES_TESTS',business:'RUN_BUSINESS_POSTGRES_TESTS',community:'RUN_COMMUNITY_POSTGRES_TESTS',health:'RUN_HEALTH_CHAT_POSTGRES',cloudbase:'RUN_DOCKER_CLOUDBASE_TESTS'};
const env=localTestEnvironment(process.env,pathToFileURL(resolve('scripts/local-test-guard.mjs')).href);
let args:string[];
if(task==='unit'&&!extra.length)args=[tsx,'--test','--test-concurrency=4',...(await readdir('tests')).filter(p=>p.endsWith('.test.ts')).sort().map(p=>`tests/${p}`)];
else if(task==='browser'&&!extra.length)args=[pw,'test'];
else if(task?.startsWith('browser-')&&configs[task.slice(8)]&&!extra.length){
  if(task==='browser-business')await validateLocalTestConfig('business');
  args=[pw,'test','--config',configs[task.slice(8)]];
}
else if(task?.startsWith('pg-')&&pg[task.slice(3)]&&!extra.length){
  const name=task.slice(3),flag=flags[name];
  if(process.env[flag]==='1'){
    if(name==='structure'){await validateLocalTestConfig('structure');env.TEST_DATABASE_URL_FILE='.local-data/deployment/db-test-url';}
    if(name==='community'||name==='business')await validateLocalTestConfig('app');
    if(name==='business')await validateLocalTestConfig('owner');
    if(['business','health','cloudbase'].includes(name)&&probeDocker().state!=='available')throw Error('LOCAL_DOCKER_REQUIRED');
    env[flag]='1';
  }
  args=[tsx,'--test',`tests/${pg[name]}`];
}
else throw Error('LOCAL_TEST_TASK_REQUIRED');
const child=spawn(process.execPath,args,{cwd:resolve('.'),env,stdio:'inherit',shell:false,windowsHide:true});
child.on('error',()=>{console.error('LOCAL_TEST_PROCESS_FAILED');process.exitCode=1;});
child.on('close',code=>{process.exitCode=code??1;});
