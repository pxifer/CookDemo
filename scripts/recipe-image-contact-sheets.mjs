import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_PACKAGE_PATH??'C:/Users/彭霄/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const jobs=JSON.parse(await readFile('datasets/recipes/curation/recipe-image-jobs-2026-10-27.json','utf8'));
const limit=Number(process.argv.find(arg=>arg.startsWith('--limit='))?.split('=')[1]??jobs.length);
const output='artifacts/acceptance/recipe-images-2026-10-27/contact-sheets';await mkdir(output,{recursive:true});
for(let start=0;start<limit;start+=16){
  const page=jobs.slice(start,Math.min(start+16,limit)),tiles=[];
  for(const [index,job] of page.entries()){
    let image;try{image=await sharp('frontend/public/assets/recipes/'+job.filename.replace(/\.png$/,'.webp')).resize(320,240,{fit:'contain',background:'#faf7ed'}).toBuffer();}catch{continue;}
    const top=Math.floor(index/4)*276,left=(index%4)*320;
    tiles.push({input:image,top,left});
    const label=await sharp({text:{text:job.id+' '+job.dish,font:'Microsoft YaHei 16',rgba:true,width:308,height:28,align:'center'}}).png().toBuffer();
    tiles.push({input:label,top:top+244,left:left+6});
  }
  if(tiles.length){await sharp({create:{width:1280,height:Math.ceil(page.length/4)*276,channels:3,background:'#faf7ed'}}).composite(tiles).png().toFile(output+'/sheet-'+String(start/16+1).padStart(2,'0')+'.png');}
}
console.log(JSON.stringify({contactSheets:Math.ceil(limit/16)}));
