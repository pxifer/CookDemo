import {createRequire} from 'node:module';
import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_PACKAGE_PATH??'C:/Users/彭霄/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const jobs=JSON.parse(await readFile('docs/data/recipe-image-jobs-2026-10-27.json','utf8'));
const directory=resolve('public/assets/recipes'),output=resolve('acceptance/recipe-images-2026-10-27');
await mkdir(output,{recursive:true});
const sha=data=>createHash('sha256').update(data).digest('hex');
const complete=new Map();
const watch=process.argv.includes('--watch');
do{
  let updated=false;
  for(const job of jobs){
    if(complete.has(job.id))continue;
    const source=join(directory,job.filename),webpName=job.filename.replace(/\.png$/,'.webp'),webpPath=join(directory,webpName);
    try{
      const raw=await readFile(source),meta=await sharp(raw).metadata();
      if(meta.format!=='png'||meta.width<1000||meta.height<700)throw Error(`INVALID_IMAGE_${job.id}`);
      let encoded;
      try{encoded=await readFile(webpPath);await sharp(encoded).metadata();}catch(error){if(error.code!=='ENOENT')throw error;}
      if(!encoded){encoded=await sharp(raw).resize({width:1280,withoutEnlargement:true}).webp({quality:90,effort:5}).toBuffer();await writeFile(webpPath,encoded,{flag:'wx'});}
      const decoded=await sharp(encoded).metadata();
      complete.set(job.id,{id:job.id,dish:job.dish,image:`/assets/recipes/${webpName}`,original:`/assets/recipes/${job.filename}`,sourceBytes:raw.length,webpBytes:encoded.length,width:decoded.width,height:decoded.height,sha256:sha(raw),webpSha256:sha(encoded)});
      updated=true;
    }catch(error){if(!['ENOENT','EBUSY','EPERM'].includes(error.code)&&!String(error.message).match(/corrupt|premature|header|Input buffer/))throw error;}
  }
  if(updated){
    const records=jobs.flatMap(job=>complete.has(job.id)?[complete.get(job.id)]:[]);
    await writeFile(join(output,'asset-progress.json'),JSON.stringify({total:jobs.length,complete:records.length,records},null,2)+'\n');
    console.log(JSON.stringify({compressed:records.length,total:jobs.length}));
  }
  if(!watch||complete.size===jobs.length)break;
  await new Promise(resolve=>setTimeout(resolve,1500));
}while(true);
if(complete.size===jobs.length){
  const records=jobs.map(job=>complete.get(job.id));
  if(new Set(records.map(record=>record.sha256)).size!==records.length)throw Error('DUPLICATE_GENERATED_IMAGE');
  await writeFile('docs/data/recipe-image-additions-2026-10-27.json',JSON.stringify(records.map(({id,dish,image})=>({id,dish,image})),null,2)+'\n');
  await writeFile(join(output,'assets.json'),JSON.stringify({count:records.length,tool:'built-in image_gen',originalsPreserved:true,quality:90,maxWidth:1280,records},null,2)+'\n');
  console.log(JSON.stringify({complete:true,count:records.length}));
}
