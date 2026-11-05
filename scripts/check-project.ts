import { spawn,execFileSync } from 'node:child_process';
import { mkdir,readFile,readdir,writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { join,resolve,relative,sep } from 'node:path';
import { acceptanceEnvironment,dockerExecutable } from './lib/acceptance-environment';
import { sha256 as sha,sourceHashes,sourceFingerprint,treeHashes } from './lib/source-fingerprint';
import {checkPlan,type CheckSummary} from './lib/check-plan';
import { pathToFileURL } from 'node:url';
import { localTestEnvironment } from './local-test-guard.mjs';
import { validateLocalTestConfig } from './lib/local-test-config';

const root=resolve('.'),runId=new Date().toISOString().replace(/[:.]/g,'-');
const out=resolve(process.env.PROJECT_ACCEPTANCE_DIR??`artifacts/acceptance/project-check-${runId}`);
await mkdir(out,{recursive:true});
const tsx='node_modules/tsx/dist/cli.mjs',playwright='node_modules/@playwright/test/cli.js';
const unitFiles=(await readdir('tests')).filter(name=>name.endsWith('.test.ts')).sort().map(name=>join('tests',name));
const stages=[
  {id:'validation',args:[tsx,'scripts/generate-validation.ts']},
  {id:'types',args:['node_modules/typescript/bin/tsc','--noEmit']},
  {id:'acceptance-types',args:['node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.acceptance.json']},
  {id:'web-build',args:['node_modules/vite/bin/vite.js','build']},
  {id:'unit',args:[tsx,'--test','--test-concurrency=4',...unitFiles]},
  {id:'knowledge-integrity',args:[tsx,'scripts/health-knowledge.ts','verify']},
  {id:'retrieval-editorial',args:[tsx,'scripts/evaluate-health-knowledge-v2.ts']},
  {id:'recipe-evidence',args:[tsx,'scripts/recipe-evidence-demo.ts']},
  {id:'ai-contract',args:[tsx,'scripts/evaluate-ai-recipes.ts']},
  {id:'agent-candidates-contract',args:[tsx,'scripts/evaluate-agent-candidates.ts']},
  {id:'browser',args:[playwright,'test']},
  {id:'health-browser',args:[playwright,'test','--config','playwright.health-chat.config.ts']},
  {id:'registration-browser',args:[playwright,'test','--config','playwright.registration.config.ts']},
  {id:'business-browser',args:[playwright,'test','--config','playwright.business.config.ts']},
];
const pgStages=[
  {id:'pg-structure',file:'tests/postgres.integration.ts',flag:'RUN_POSTGRES_TESTS',docker:false,needs:'structureTestDatabase'},
  {id:'pg-business',file:'tests/business-postgres.integration.ts',flag:'RUN_BUSINESS_POSTGRES_TESTS',docker:true,needs:'ownerDatabase'},
  {id:'pg-candidates',file:'tests/candidate-library.test.ts',flag:'CANDIDATE_PG_INTEGRATION',docker:false,needs:'appDatabase'},
  {id:'pg-community',file:'tests/community-local-postgres.integration.ts',flag:'RUN_COMMUNITY_POSTGRES_TESTS',docker:false,needs:'appDatabase'},
  {id:'pg-health-and-tasks',file:'tests/health-chat-postgres.integration.ts',flag:'RUN_HEALTH_CHAT_POSTGRES',docker:true,needs:'none',containerOnly:true},
  {id:'pg-cloud-migrations',file:'tests/cloudbase-migrations.integration.ts',flag:'RUN_DOCKER_CLOUDBASE_TESTS',docker:true,needs:'none',containerOnly:true},
];
const allStages=[...stages,...pgStages.map(p=>({id:p.id,args:[tsx,'--test',p.file]}))];
const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--retry-failed'))throw Error('CHECK_ARGUMENTS: [--retry-failed <acceptance-report>]');
let parent:{report:string;reportSha256:string;sourceFingerprint:string}|undefined,previous:CheckSummary|undefined;
if(args.length){
  const path=resolve(args[1]);if(!path.startsWith(resolve('artifacts/acceptance')+sep))throw Error('RETRY_REPORT_MUST_BE_UNDER_ACCEPTANCE');
  const bytes=await readFile(path),prior=JSON.parse(bytes.toString());previous=prior;
  parent={report:relative(root,path),reportSha256:sha(bytes),sourceFingerprint:prior.sourceFingerprint};
}
const plan=checkPlan(allStages.map(stage=>stage.id),previous),selected=new Set(plan.selected);
const hashes=await sourceHashes();
let commit:string|null=null;try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
const results:unknown[]=[];
const environment=await acceptanceEnvironment();
const childEnvironment=localTestEnvironment(process.env,pathToFileURL(resolve('scripts/local-test-guard.mjs')).href);
console.log('LOCAL ONLY: loopback HTTP / local PostgreSQL / synthetic accounts and models; cloud tests and paid inference disabled.');
await writeFile(join(out,'environment.json'),JSON.stringify(environment,null,2)+'\n');
const browserPorts:Record<string,number>={browser:4175,'health-browser':4198,'registration-browser':4178,'business-browser':4181};
for(const stage of allStages){
  const start=Date.now(),log=join(out,`${stage.id}.txt`);
  if(!selected.has(stage.id)){
    const reason='Not selected for focused retry; earlier evidence is retained separately and is not copied as a fresh pass.';
    await writeFile(log,reason+'\n');results.push({id:stage.id,status:'not_run',reason,log:relative(out,log)});continue;
  }
  const pg=pgStages.find(p=>p.id===stage.id),tcp=environment.tcp.find(p=>p.port===(pg?('containerOnly' in pg?undefined:5432):browserPorts[stage.id]));
  const business=stage.id==='business-browser',databaseTcp=environment.tcp.find(p=>p.port===5432);
  const permission=tcp?.state==='permission_blocked'?tcp.code:pg?.docker&&environment.docker.state==='permission_blocked'?environment.docker.code:business&&databaseTcp?.state==='permission_blocked'?databaseTcp.code:null;
  if(permission){
    const reason=`Required environment operation denied: ${permission}; this is not a test pass.`;
    await writeFile(log,reason+'\n');results.push({id:stage.id,status:'permission_blocked',reason,command:[process.execPath,...stage.args],log:relative(out,log)});console.log(`CHECK ${stage.id}: PERMISSION BLOCKED (${permission})`);continue;
  }
  const missing=pg?(pg.docker&&environment.docker.state!=='available'?'Docker daemon unavailable':pg.needs!=='none'&&!environment.configurationFiles[pg.needs as keyof typeof environment.configurationFiles]?'isolated database configuration missing':!pg.docker&&tcp?.state!=='available'?'PostgreSQL not reachable':null):stage.id==='business-browser'&&!environment.configurationFiles.businessEnvironment?'business browser environment missing':null;
  if(missing){await writeFile(log,missing+'\n');results.push({id:stage.id,status:'not_run',reason:missing,log:relative(out,log)});console.log(`CHECK ${stage.id}: NOT RUN (${missing})`);continue;}
  try{
    if(pg?.needs==='structureTestDatabase')await validateLocalTestConfig('structure');
    if(pg?.needs==='appDatabase')await validateLocalTestConfig('app');
    if(pg?.needs==='ownerDatabase'){await validateLocalTestConfig('owner');await validateLocalTestConfig('app');}
    if(business)await validateLocalTestConfig('business');
  }catch{
    const reason='LOCAL_TEST_CONFIGURATION_REJECTED: require existing loopback project databases and disabled cloud/model settings; credentials omitted.';
    await writeFile(log,reason+'\n');results.push({id:stage.id,status:'not_run',reason,log:relative(out,log)});console.log(`CHECK ${stage.id}: NOT RUN (local configuration rejected)`);continue;
  }
  console.log(`CHECK ${stage.id} …`);
  const stream=createWriteStream(log);
  const result=await new Promise<{exitCode:number|null;error?:string}>(done=>{
    const child=spawn(process.execPath,stage.args,{cwd:root,env:{...childEnvironment,...(pg?{[pg.flag]:'1',DOCKER_EXE:dockerExecutable()??'',...(pg.id==='pg-structure'?{TEST_DATABASE_URL_FILE:'.local-data/deployment/db-test-url'}:{})}:{}),...(stage.id==='business-browser'?{BUSINESS_BROWSER:'1'}:{}),AGENT_EVALUATION_DIR:join(out,'agent-candidates'),REGISTRATION_ACCEPTANCE_DIR:join(out,'registration'),ACCEPTANCE_DIR:join(out,'ordinary'),HEALTH_CHAT_ACCEPTANCE_DIR:join(out,'health'),HEALTH_EVALUATION_DIR:join(out,'retrieval'),RECIPE_EVIDENCE_DIR:join(out,'recipe-evidence'),AI_EVALUATION_DIR:join(out,'ai-contract')},timeout:stage.id.includes('browser')?1200000:600000,shell:false,stdio:['ignore','pipe','pipe']});
    child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});
    child.on('error',error=>done({exitCode:null,error:error.message}));child.on('close',exitCode=>done({exitCode}));
  });
  stream.end();await once(stream,'finish');
  results.push({id:stage.id,...result,status:result.exitCode===0?'passed':'failed',elapsedMs:Date.now()-start,command:[process.execPath,...stage.args],log:relative(out,log)});
  console.log(`CHECK ${stage.id}: ${result.exitCode===0?'PASS':'FAIL'} (${Date.now()-start} ms)`);
}
const finalHashes=await sourceHashes();
const buildHashes=await treeHashes('artifacts/build/web').catch(()=>({}));
const sourceStable=JSON.stringify(finalHashes)===JSON.stringify(hashes);
const failed=results.filter(row=>(row as {status:string}).status==='failed').length+(sourceStable?0:1);
const permissionBlocked=results.filter(row=>(row as {status:string}).status==='permission_blocked').length;
const notRun=results.filter(row=>(row as {status:string}).status==='not_run').length;
const focusedChecksComplete=failed===0&&permissionBlocked===0&&(results as {id:string;status:string}[]).filter(row=>selected.has(row.id)).every(row=>row.status==='passed');
const report={runId,commit,runMode:plan.mode,retryOf:parent,selectedStageIds:plan.selected,focusedChecksComplete,executionPolicy:{localOnly:true,publicHttpBlocked:true,paidModelsAllowed:false,cloudTestEnvironmentRequired:false},sourceFingerprint:sourceFingerprint(hashes),sourceStable,hashes,buildHashes,results,failed,permissionBlocked,notRun,localGateComplete:failed===0&&permissionBlocked===0&&notRun===0,releaseReady:false,
  external:[
    {id:'real-postgres-multiconnection',status:results.filter(row=>(row as {id:string}).id.startsWith('pg-')).every(row=>(row as {status:string}).status==='passed')?'passed':'not_complete',reason:'See the six explicit pg stages; no PGlite substitution'},
    {id:'real-provider-quality',status:'not_run',reason:'disabled by local-only test policy; mock is contract evidence only'},
    {id:'cloud-deploy-and-restore',status:'not_run',reason:'deferred to preserve cloud resources; local tests never target the live website'},
    {id:'independent-human-evaluation',status:'not_run',reason:'editorial retrieval regression is not a held-out human-reviewed benchmark'},
  ],scope:'local build, unit, public knowledge and synthetic browser accounts; no real credentials or paid inference'};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const reportPath=join(out,'report.json'),reportSha256=sha(await readFile(reportPath));
const summary=(predicate:(row:{id:string;status:string})=>boolean)=>{const selected=(results as {id:string;status:string}[]).filter(predicate);return selected.every(row=>row.status==='passed')?'passed':selected.some(row=>row.status==='failed')?'failed':selected.some(row=>row.status==='permission_blocked')?'permission_blocked':'not_run';};
const evidence=[{id:'local_check',kind:'local',status:summary(row=>!row.id.startsWith('pg-')&&!row.id.includes('browser'))},{id:'postgres_integrations',kind:'postgres',status:summary(row=>row.id.startsWith('pg-'))},{id:'browser_regressions',kind:'browser',status:summary(row=>row.id.includes('browser'))},...(['account_recovery_erasure','business_restore_drill','independent_ai_quality','staging_acceptance','rollback_drill'] as const).map(id=>({id,kind:({account_recovery_erasure:'account',business_restore_drill:'restore',independent_ai_quality:'human_review',staging_acceptance:'staging',rollback_drill:'rollback'} as const)[id],status:'not_run'}))].map(row=>({...row,sourceFingerprint:report.sourceFingerprint,report:row.status==='not_run'?'':relative(root,reportPath),reportSha256:row.status==='not_run'?'':reportSha256}));
await writeFile(join(out,'release-evidence.json'),JSON.stringify({sourceFingerprint:report.sourceFingerprint,evidence},null,2)+'\n');
const passedGroup=(predicate:(id:string)=>boolean)=>(results as {id:string;status:string}[]).filter(row=>predicate(row.id)&&row.status==='passed').length;
console.log(`Report: ${join(out,'report.json')} | failed=${failed}; permission_blocked=${permissionBlocked}; not_run=${notRun}; PostgreSQL=${passedGroup(id=>id.startsWith('pg-'))}/6; browser=${passedGroup(id=>id.includes('browser'))}/4; releaseReady=false`);
if(failed)process.exitCode=1;else if(plan.mode==='retry_failed'&&focusedChecksComplete)process.exitCode=0;else if(permissionBlocked||notRun)process.exitCode=2;
