import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const [source,destination]=process.argv.slice(2);if(!source||!destination)throw Error('Provide reviewed dataset and a new freeze destination');
const dataset=JSON.parse(await readFile(source,'utf8'));
if(!Array.isArray(dataset.cases)||!dataset.cases.length)throw Error('EVALUATION_DATASET_INVALID');
const clusters=new Map<string,string>();
const ids=new Set<string>();
for(const row of dataset.cases){
  const a=row.annotation;
  if(typeof row.id!=='string'||ids.has(row.id)||typeof row.clusterId!=='string'||!row.clusterId||!['development','holdout_candidate','holdout'].includes(row.split))throw Error('EVALUATION_CASE_INVALID');ids.add(row.id);
  if(a?.status!=='reviewed'||a.sourceVerified!==true||!Number.isFinite(Date.parse(a.reviewedAt))||!Array.isArray(a.reviewers)||new Set(a.reviewers).size<(row.dimension==='disease'?2:1)||a.reviewers.includes(a.author)||a.reviewers.some((name:unknown)=>typeof name!=='string'||!name.trim()))throw Error(`INDEPENDENT_REVIEW_PENDING:${row.id}`);
  const previous=clusters.get(row.clusterId);if(previous&&previous!==row.split)throw Error(`EVALUATION_CLUSTER_LEAK:${row.clusterId}`);clusters.set(row.clusterId,row.split);
}
await writeFile(destination,JSON.stringify({...dataset,cases:dataset.cases.map((row:any)=>({...row,split:row.split==='holdout_candidate'?'holdout':row.split})),status:'independently_reviewed_frozen',frozenAt:new Date().toISOString(),datasetHash:createHash('sha256').update(JSON.stringify(dataset)).digest('hex')},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({frozen:true,cases:dataset.cases.length,destination}));
