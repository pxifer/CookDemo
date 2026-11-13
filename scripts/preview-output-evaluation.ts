/** Local evaluation console. No production account, browser credential extraction or deployment. */
import Fastify from 'fastify';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readOutputDataset,validateHumanReview} from './lib/recipe-output-evaluation';
import {initializeOutputCampaign,outputCampaignDirectory,outputCampaign,outputExecutionPolicy} from './lib/output-evaluation-budget';

if(process.env.LOCAL_RAG_OUTPUT_EVALUATION!=='1'||process.versions.node.split('.')[0]!=='24')throw Error('OUTPUT_CONSOLE_EXPLICIT_NODE24_REQUIRED');
const port=Number(process.env.LOCAL_RAG_OUTPUT_EVALUATION_PORT??15260);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('OUTPUT_CONSOLE_PORT_INVALID');
const origin=`http://127.0.0.1:${port}`,token=randomBytes(24).toString('hex'),root=await initializeOutputCampaign();
let key='',busy=false;const app=Fastify({logger:false,bodyLimit:16000});
app.addHook('onRequest',async(req,reply)=>{
 if(req.headers.host!==`127.0.0.1:${port}`)return reply.code(403).send({error:'LOCAL_HOST_REQUIRED'});
 if(req.method!=='GET'&&(req.headers.origin!==origin||req.headers['x-evaluation-token']!==token))return reply.code(403).send({error:'LOCAL_ORIGIN_AND_TOKEN_REQUIRED'});
 reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer').header('X-Content-Type-Options','nosniff');
});
app.setErrorHandler((_error,_req,reply)=>reply.code(400).send({error:'请求未完成；请检查输入、预算或本地运行日志，未自动重试。'}));
const runDirectory=join(root,'runs');await mkdir(runDirectory,{recursive:true});
async function readRuns(){
 const dirs=(await readdir(runDirectory,{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort();
 return (await Promise.all(dirs.map(async id=>{try{
  const report=JSON.parse(await readFile(join(runDirectory,id,'report.json'),'utf8'));
  const names=(await readdir(join(runDirectory,id))).filter(n=>/^human-review-[\w.-]+\.json$/.test(n)).sort();
  report.humanReviews=await Promise.all(names.map(n=>readFile(join(runDirectory,id,n),'utf8').then(JSON.parse)));
  return report;
 }catch{return null;}}))).filter(Boolean);
}
async function budgetSnapshot(){
 const text=await readFile(join(root,'budget.jsonl'),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
 const records=text.trim()?text.trim().split('\n').map(line=>JSON.parse(line)):[];
 return {ceilingCny:5,reservedCny:records.reduce((n,r)=>n+r.reservedMicroCny,0)/1e6,reservedRequests:records.length,maximumRequests:(await outputExecutionPolicy(root)).maximumAttempts,pricingDate:'2026-11-13',currency:'CNY',note:'保守预留累计；失败不自动退还，不等于供应商最终账单'};
}
app.get('/',async(_req,reply)=>reply.header('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'").type('text/html').send((await readFile('scripts/ui/output-evaluation.html','utf8')).replace('__EVALUATION_TOKEN__',token)));
app.get('/api/state',async()=>({campaign:outputCampaign,keySaved:Boolean(key),busy,budget:await budgetSnapshot(),dataset:await readOutputDataset(),runs:(await readRuns()).map(r=>({runId:r.runId,caseId:r.caseId,title:r.title,variant:r.variant,mode:r.mode,score:r.score,provenance:r.provenance,humanReviews:r.humanReviews,observed:{result:r.observed.result?{status:r.observed.result.status}:undefined,error:r.observed.error,coverage:r.observed.coverage,unmetNeeds:r.observed.unmetNeeds}}))}));
app.post('/api/key',async(req,reply)=>{
 const body=req.body as any;if(!body||Object.keys(body).join(',')!=='key'||typeof body.key!=='string'||body.key.length<8||body.key.length>512||/[\r\n]/.test(body.key))return reply.code(400).send({error:'请填写有效Key；仅本机进程内保存。'});
 key=body.key;return {keySaved:true};
});
app.post('/api/custom-case',async(req,reply)=>{
 const body=req.body as any;
 if(!body||Object.keys(body).some(k=>!['text','ingredients','allowBuy','expectation'].includes(k))||typeof body.text!=='string'||!body.text.trim()||body.text.length>2000||typeof body.ingredients!=='string'||body.ingredients.length>500||typeof body.allowBuy!=='boolean'||typeof body.expectation!=='string'||body.expectation.length>2000)return reply.code(400).send({error:'请输入不超过2000字的问题和期望；食材可留空。'});
 const id='custom-'+randomBytes(12).toString('hex'),directory=join(root,'custom-cases');await mkdir(directory,{recursive:true});
 const item={id,title:'自由输入：'+body.text.trim().slice(0,40),task:'open_input',family:id,split:'development',input:{profile:{conditions:[],goals:[],notes:''},userText:body.text.trim(),...(body.ingredients.trim()?{ingredients:body.ingredients.trim()}:{}),allowBuy:body.allowBuy}};
 await writeFile(join(directory,id+'.input.json'),JSON.stringify(item,null,2)+'\n',{flag:'wx',mode:0o600});
 await writeFile(join(directory,id+'.label.json'),JSON.stringify({id,humanExpectation:body.expectation.trim(),origin:'user_expectation',professionalReview:'pending'},null,2)+'\n',{flag:'wx',mode:0o600});
 return {id,saved:true,automaticCalls:0};
});
app.post('/api/run',async(req,reply)=>{
 const body=req.body as any;
 if(!body||Object.keys(body).some(k=>!['caseId','variant','mode'].includes(k))||!['baseline','rag'].includes(body.variant)||!['fixture','live'].includes(body.mode)||(await readOutputDataset()).cases.every(c=>c.id!==body.caseId))return reply.code(400).send({error:'评测用例或模式无效。'});
 if(busy)return reply.code(409).send({error:'当前用例尚未完成；串行执行，不重复请求。'});
 const item=(await readOutputDataset()).cases.find(c=>c.id===body.caseId)!;
 if(body.mode==='live'&&item.task!=='food_guidance'&&!key)return reply.code(400).send({error:'请先在本地评测台保存Key。'});
 busy=true;
 try{
  const child=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/recipe-output-worker.ts'],{cwd:resolve('.'),env:{...process.env,LOCAL_RAG_OUTPUT_EVALUATION:'1'},stdio:['pipe','pipe','pipe'],windowsHide:true});
  let stdout='',stderr='';const done=new Promise<number|null>((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  child.stdout.on('data',b=>{stdout+=b.toString();});child.stderr.on('data',b=>{if(stderr.length<1000)stderr+=b.toString();});
  child.stdin.end(JSON.stringify({...body,key:body.mode==='live'?key:''}));
  const code=await done;
  if(code!==0)return reply.code(400).send({error:'评测未完成：预算/授权/本地配置拒绝，或进程退出。未自动重试。',budget:await budgetSnapshot()});
  const summary=JSON.parse(stdout.trim());
  if(!/^[\w.-]+$/.test(summary.runId))throw Error('OUTPUT_WORKER_RECEIPT_INVALID');
  return {run:JSON.parse(await readFile(join(runDirectory,summary.runId,'report.json'),'utf8')),budget:await budgetSnapshot()};
 }finally{busy=false;}
});
app.get('/api/run/:id',async(req,reply)=>{const {id}=req.params as {id:string};const report=/^[\w.-]+$/.test(id)?(await readRuns()).find(r=>r.runId===id):undefined;if(!report)return reply.code(404).send({error:'RUN_NOT_FOUND'});return report;});
app.post('/api/review/:id',async(req,reply)=>{
 const {id}=req.params as {id:string};if(!/^[\w.-]+$/.test(id))return reply.code(400).send({error:'RUN_INVALID'});
 const report=(await readRuns()).find(r=>r.runId===id);if(!report)return reply.code(404).send({error:'RUN_NOT_FOUND'});
 const review=validateHumanReview(req.body),reviewPath=join(runDirectory,id,`human-review-${Date.now()}-${randomBytes(4).toString('hex')}.json`);
 await writeFile(reviewPath,JSON.stringify({runId:id,sourceFingerprint:report.provenance.sourceFingerprint,...review},null,2)+'\n',{flag:'wx',mode:0o600});
 return {saved:true,review,automaticFunctionalPass:report.score.functionalPass,effectivePass:report.score.functionalPass&&review.score>=75&&review.scores.goalFit>=3&&review.scores.reasonSupport>=3&&review.scores.conditionsAndUnknowns>=3&&!review.criticalFailures.length,note:'总分至少75且目标/理由/条件三项各至少3分，无硬失败；阈值为工程初值，不表示医学有效或专业审核通过'};
});
await app.listen({host:'127.0.0.1',port});
console.log(JSON.stringify({url:origin,campaign:outputCampaign,ceilingCny:5,automaticCalls:0,keyStored:'memory_only',productionChanges:false}));
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{key='';void app.close();});
