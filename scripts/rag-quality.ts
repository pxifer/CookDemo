import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {auditQualitySuite,canonicalQualityJson} from './lib/rag-quality-protocol';
import {createHash} from 'node:crypto';
const [mode,input,registryPath,output,...extra]=process.argv.slice(2);
if(!['audit','freeze'].includes(mode)||!input||!registryPath||!output||extra.length)throw Error('USAGE_rag_quality_audit_or_freeze_input_registry_output');
const suite=JSON.parse(await readFile(input,'utf8')),registry=JSON.parse(await readFile(registryPath,'utf8'));
const report=auditQualitySuite(suite,registry);
await mkdir(output,{recursive:true});
async function immutable(path:string,body:string){try{await writeFile(path,body,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST'||await readFile(path,'utf8')!==body)throw Error('QUALITY_IMMUTABLE_OUTPUT_CHANGED_USE_NEW_DIRECTORY');}}
if(mode==='freeze'){
  if(report.errors.length)throw Error('QUALITY_FREEZE_REJECTED');
  // Candidate split manifests may be frozen without pretending to possess human gold.
  const bytes=canonicalQualityJson(suite);
  await immutable(join(output,'dataset.json'),bytes);
  await immutable(join(output,'manifest.json'),canonicalQualityJson({schemaVersion:1,id:report.id,normalizedPayloadSha256:report.sha256,files:{'dataset.json':createHash('sha256').update(bytes).digest('hex')},independentAcceptanceReady:report.independentAcceptanceReady,pendingIndependentReview:report.pendingIndependentReview,kind:report.independentAcceptanceReady?'declared_independent_reviewed':'candidate_assignment_only'}));
}
await immutable(join(output,'audit.json'),canonicalQualityJson(report));
console.log(JSON.stringify({report:resolve(output,'audit.json'),...report}));
if(report.errors.length)process.exitCode=1;
