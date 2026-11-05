// Optional offline authoring tool. Runtime/build only serve the already-created assets.
// Original generated PNG files remain intact. No network requests or API calls.
import { createRequire } from 'node:module';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const require=createRequire(import.meta.url);
let sharp;
try { sharp=require(process.env.SHARP_PACKAGE_PATH||'sharp'); }
catch { throw new Error('OFFLINE_SHARP_REQUIRED: use installed sharp or set SHARP_PACKAGE_PATH; no automatic installation'); }
const directory=resolve('frontend/public/assets/recipes');
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=(await readdir(directory)).filter(f=>/^[a-z0-9-]+\.png$/.test(f)).sort();
const entries=[];
const missingOnly=process.argv.includes('--missing-only');
for(const file of files){
  const original=await readFile(join(directory,file));
  const output=file.replace(/\.png$/,'.webp');
  let encoded;
  if(missingOnly)try {encoded=await readFile(join(directory,output));}catch(error){if(error.code!=='ENOENT')throw error;}
  const reused=!!encoded;
  encoded??=await sharp(original).rotate().resize({width:1280,withoutEnlargement:true}).webp({quality:90,effort:5}).toBuffer();
  const decoded=await sharp(encoded).metadata();
  if(decoded.format!=='webp'||!decoded.width||!decoded.height||encoded.length>=original.length)throw new Error('IMAGE_ENCODING_VALIDATION_FAILED');
  if(!reused)await writeFile(join(directory,output),encoded,{flag:missingOnly?'wx':'w'});
  entries.push({source:file,sourceSha256:sha(original),webp:output,webpSha256:sha(encoded),sourceBytes:original.length,webpBytes:encoded.length,width:decoded.width,height:decoded.height});
}
const sourceBytes=entries.reduce((n,e)=>n+e.sourceBytes,0),webpBytes=entries.reduce((n,e)=>n+e.webpBytes,0);
const report={checkedAt:new Date().toISOString(),tool:`sharp ${sharp.versions.sharp}`,quality:90,maxWidth:1280,originalsPreserved:true,count:entries.length,sourceBytes,webpBytes,savedPercent:Number((100*(1-webpBytes/sourceBytes)).toFixed(1)),entries};
await writeFile(resolve('datasets/recipes/curation/recipe-image-optimization.json'),JSON.stringify(report,null,2)+'\n');
const manifest=JSON.parse(await readFile(resolve('datasets/recipes/curation/recipe-candidate-images.json'),'utf8'));
const cards=(await readFile(resolve('datasets/recipes/curation/recipe-cards-v3.jsonl'),'utf8')).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
const supplemental=(await readFile(resolve('datasets/recipes/curation/recipe-candidates-supplement-v1.jsonl'),'utf8')).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
cards.push(...supplemental);
const totalDishes=new Set(cards.filter(c=>c.source==='howtocook').map(c=>c.dish_key)).size;
const mapped=manifest.generated.map(item=>({id:item.id,name:cards.find(c=>c.id===item.id)?.dish_key,url:item.image}));
if(mapped.some(m=>!m.name||!entries.some(e=>'/assets/recipes/'+e.source===m.url)))throw new Error('IMAGE_MAPPING_REPORT_INVALID');
const dishCount=new Set(mapped.map(m=>m.name)).size;
const promptFiles=(await readdir(resolve('datasets/recipes/curation'))).filter(f=>/^recipe-image-prompts-.*\.json$/.test(f)).sort();
const md=[
  '# 菜谱图片离线处理报告', '', `生成：${report.checkedAt}（UTC，见时间后缀）。本报告只描述工具处理的文件及候选映射，不代表当前线上目录或发布状态。`, '',
  `候选配图 **${dishCount}/${totalDishes}道**，待补 **${totalDishes-dishCount}道**；图片审核状态仍为pending_review。覆盖率表示展示映射和实际文件齐全，不改变原方、成分或营养的审核状态；线上加载另行验证。`, '',
  `网页文件共${report.count}张（含构造目录的番茄炒蛋），由PNG ${(sourceBytes/1048576).toFixed(1)} MiB压缩为WebP ${(webpBytes/1048576).toFixed(1)} MiB，减少${report.savedPercent}%。原PNG保留；最大宽1280、质量90，不改菜品构图。`, '',
  '网页优先加载同菜WebP，失败后回退同名PNG；两者均失败才显示缺图，不替换其他菜。图片为原创生成成品示意，不能当成来源原方的实拍或试做证明。', '',
  '| 候选ID | 菜品 | 网页图片 |', '| --- | --- | --- |',
  ...mapped.map(m=>`| ${m.id} | ${m.name} | [查看](../../public${m.url.replace(/\.png$/,'.webp')}) |`),'',
  '完整提示词：'+promptFiles.map(f=>`[${f}](../../../datasets/recipes/curation/${f})`).join('、')+'；早期批次见来源及图片映射记录。生成工具为内置image_gen，离线网页编码为sharp。后续新增图先核对原料和做法，再加入映射、生成网页文件、更新本机候选库、回读HTTP图片。','',
];
const reportDirectory=resolve('artifacts/acceptance/recipe-image-optimization');
await mkdir(reportDirectory,{recursive:true});
await writeFile(join(reportDirectory,'report.md'),md.join('\n'));
console.log(JSON.stringify({count:report.count,sourceBytes,webpBytes,savedPercent:report.savedPercent}));
