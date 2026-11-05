import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { searchKnowledgeA0 as searchKnowledge, validateKnowledgeBundle } from '../backend/src/health-knowledge';
const bundle=validateKnowledgeBundle(JSON.parse(await readFile(new URL('../datasets/health/2026-10-28-v1/knowledge-bundle.json', import.meta.url),'utf8')));
const cases: {id:string;query:string;expectedFactIds:string[]}[]=JSON.parse(await readFile(new URL('../datasets/health/retrieval-regression.json', import.meta.url),'utf8'));
const context={adult:'yes',renalFunction:'normal',hyperkalemia:'no',complexComorbidity:'no',diabetesType:'type2',hypoglycemiaRescue:'no',energyPlanCompatible:'yes'};
const rows=cases.map(c=>{
  const result=searchKnowledge(bundle,c.query,{context,limit:20});
  const ids=result.hits.map(h=>h.fact.id);
  return {...c,passed:c.expectedFactIds.every(id=>ids.includes(id)),ranks:c.expectedFactIds.map(id=>ids.indexOf(id)+1),executionAllowed:result.executionAllowed};
});
const report={id:bundle.id,evaluation:'20 editorial regression cases; not an independent held-out retrieval benchmark or clinical evaluation',index:'lexical-v1',embedding:null,total:rows.length,passed:rows.filter(r=>r.passed).length,rows};
await mkdir(new URL('../artifacts/acceptance/health-knowledge-2026-10-28', import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/acceptance/health-knowledge-2026-10-28/retrieval-regression.json', import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:rows.filter(r=>!r.passed)},null,2));
if (report.passed!==report.total) process.exitCode=1;
