import { readFile, writeFile } from 'node:fs/promises';
import { searchKnowledgeA0 as searchKnowledge, validateKnowledgeBundle, sha256 } from '../../../server/health-knowledge';
const root = new URL('../../../', import.meta.url);
const raw = await readFile(new URL('data/health/2026-10-28-v1/knowledge-bundle.json',root),'utf8');
const bundle = validateKnowledgeBundle(JSON.parse(raw));
const cases = JSON.parse(await readFile(new URL('data/health/retrieval-regression.json',root),'utf8')) as {id:string,query:string,expectedFactIds:string[]}[];
const context={adult:'yes',renalFunction:'normal',hyperkalemia:'no',complexComorbidity:'no',diabetesType:'type2',hypoglycemiaRescue:'no',energyPlanCompatible:'yes'};
const rows=cases.map(c=>{
 const result=searchKnowledge(bundle,c.query,{context,limit:50});
 const ranks=c.expectedFactIds.map(id=>{const n=result.hits.findIndex(h=>h.fact.id===id);return n<0?null:n+1;});
 return {...c,ranks,allExpectedAt:Object.fromEntries([1,5,10,20].map(k=>[k,ranks.every(n=>n!==null&&n<=k)]))};
});
const probes=['高血压少吃盐吗','痛风牛奶能不能喝','糖尿病可以吃什么','鲜香菇和干香菇一样吗','完全未知食材ZQ9'];
const report={checkedAt:'2026-10-28 Asia/Shanghai',scope:'Read-only application-in-memory audit. Editorial expected facts only; not evidence Recall, SQL throughput, independent test or medical validation.',bundle:bundle.id,bundleHash:sha256(raw),counts:{sources:bundle.sources.length,entities:bundle.entities.length,evidence:bundle.evidence.length,facts:bundle.facts.length,ruleDrafts:bundle.ruleDrafts.length,recipeBindings:bundle.recipeBindings.length},cases:rows.length,allExpectedAt:Object.fromEntries([1,5,10,20].map(k=>[k,rows.filter(r=>r.allExpectedAt[k]).length])),rows,probes:probes.map(query=>{const r=searchKnowledge(bundle,query,{limit:5});return {query,state:r.state,executionAllowed:r.executionAllowed,top:r.hits.map(h=>({id:h.fact.id,score:h.score,applicability:h.applicability}))};})};
await writeFile(new URL('./baseline-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({counts:report.counts,cases:report.cases,allExpectedAt:report.allExpectedAt,probes:report.probes},null,2));
