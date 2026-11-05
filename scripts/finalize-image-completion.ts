import { readFile, writeFile, stat } from 'node:fs/promises';
const jobs=JSON.parse(await readFile('datasets/recipes/curation/recipe-image-prompts-2026-10-25-complete.json','utf8'));
if(jobs.length!==55||new Set(jobs.map((job:any)=>job.dish)).size!==55)throw Error('IMAGE_COMPLETION_COUNT');
for(const job of jobs)if((await stat(job.asset)).size<10000)throw Error(`IMAGE_MISSING_${job.id}`);
const path='datasets/recipes/curation/recipe-candidate-images.json';
const manifest=JSON.parse(await readFile(path,'utf8'));
for(const job of jobs){
  const existing=manifest.generated.find((item:any)=>item.id===job.id);
  if(existing&&existing.image!==`/assets/recipes/${job.name}`)throw Error(`IMAGE_CONFLICT_${job.id}`);
  if(!existing)manifest.generated.push({id:job.id,dish:job.dish,style:'fine-dining-editorial',image:`/assets/recipes/${job.name}`,status:'pending_review'});
}
manifest.checkedAt=new Date().toISOString().slice(0,10);
await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({newImages:jobs.length,generatedTotal:manifest.generated.length,existingImagesPreserved:true}));
