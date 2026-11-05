import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve,join } from 'node:path';
import { searchKnowledge,searchKnowledgeA0,validateKnowledgeBundle } from '../backend/src/health-knowledge';
type Case={id:string;query:string;expectedFactIds:string[];forbiddenFactIds?:string[];expectedState?:string;context?:Record<string,string>};
const read=async(p:string)=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const v1=validateKnowledgeBundle(await read('datasets/health/2026-10-28-v1/knowledge-bundle.json'));
const v2=validateKnowledgeBundle(await read('datasets/health/2026-10-28-v2/knowledge-bundle.json'));
const common:Case[]=await read('datasets/health/retrieval-regression.json');
const added:Case[]=await read('datasets/health/retrieval-regression-v2.json');
const ctx={adult:'yes',renalFunction:'normal',complexComorbidity:'no',diabetesType:'type2',hypoglycemiaRescue:'no',hyperkalemia:'no',pregnantOrLactating:'no',osteoporosisType:'primary',ckdStage:'G4',dialysis:'no',clinicianNutritionPlan:'yes',edema:'no',lipidPattern:'high_triglycerides',energyPlanCompatible:'yes',urineOutputCategory:'normal'};
function evaluate(bundle:typeof v1,c:Case,algorithm:'a0'|'a1'){
  const r=searchKnowledge(bundle,c.query,{context:{...ctx,...c.context},limit:20,algorithm});
  const ids=r.hits.map(h=>h.fact.id),ranks=c.expectedFactIds.map(id=>ids.indexOf(id)+1);
  return {id:c.id,query:c.query,state:r.state,passed:ranks.every(n=>n>0)&&!(c.forbiddenFactIds??[]).some(id=>ids.includes(id))&&(!c.expectedState||c.expectedState===r.state),ranks,expectedFactIds:c.expectedFactIds};
}
const rows=[...common,...added].map(c=>evaluate(v2,c,'a1'));
const baseline={a0:common.map(c=>evaluate(v1,c,'a0')),a1:common.map(c=>evaluate(v1,c,'a1'))};
const hardContrast=added.filter(c=>c.expectedState||c.forbiddenFactIds?.length).map(c=>({id:c.id,a0:evaluate(v2,c,'a0'),a1:evaluate(v2,c,'a1')}));
function bench(algorithm:'a0'|'a1'){
  const samples:number[]=[];
  for(const c of common)searchKnowledge(v2,c.query,{context:ctx,algorithm});
  for(let pass=0;pass<5;pass++)for(const c of common){const start=performance.now();searchKnowledge(v2,c.query,{context:ctx,algorithm});samples.push(performance.now()-start);}
  samples.sort((a,b)=>a-b);
  return {samples:samples.length,p50ms:samples[Math.floor(samples.length*.5)],p95ms:samples[Math.floor(samples.length*.95)],note:'warm in-memory single-process observations; not SQL/cloud SLO or independent retrieval benchmark'};
}
const report={id:v2.id,evaluation:'50 source-derived editorial regression cases, not a held-out benchmark or clinical validation',total:rows.length,passed:rows.filter(r=>r.passed).length,rows,commonV1Baseline:baseline,hardContrast,bench:{node:process.version,platform:process.platform,a0:bench('a0'),a1:bench('a1')},embedding:null};
const out=process.env.HEALTH_EVALUATION_DIR?pathToFileURL(resolve(process.env.HEALTH_EVALUATION_DIR)+ '/'):new URL('../artifacts/acceptance/health-knowledge-2026-10-28-v2', import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('retrieval-comparison.json',out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:rows.filter(r=>!r.passed),commonV1:{a0:baseline.a0.filter(r=>r.passed).length,a1:baseline.a1.filter(r=>r.passed).length},hardContrast:{a0:hardContrast.filter(r=>r.a0.passed).length,a1:hardContrast.filter(r=>r.a1.passed).length,total:hardContrast.length},bench:report.bench},null,2));
if(report.passed!==report.total)process.exitCode=1;
