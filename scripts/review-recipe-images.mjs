import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const directory=resolve('artifacts/acceptance/recipe-images-2026-10-26');
await mkdir(directory,{recursive:true});
const jobs=JSON.parse(await readFile('datasets/recipes/curation/recipe-image-prompts-2026-10-25-complete.json','utf8'));
const escape=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  for(let index=0;index<jobs.length;index+=16){
    const batch=jobs.slice(index,index+16),number=index/16+1;
    const path=join(directory,`overview-${number}.html`);
    await writeFile(path,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:20px;background:#f4f4ed;color:#214c3b;font:18px system-ui}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}figure{margin:0;background:#fff;border:1px solid #deded3;border-radius:10px;overflow:hidden}img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}figcaption{padding:10px;font-weight:600}</style><h1>新增菜谱配图 ${number}</h1><div class="grid">${batch.map(job=>`<figure><img src="../../${escape(job.asset.replace(/\.png$/,'.webp'))}"><figcaption>${escape(job.id)} · ${escape(job.dish)}</figcaption></figure>`).join('')}</div></html>`);
    await page.goto(pathToFileURL(path).href);
    await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    await page.screenshot({path:join(directory,`overview-${number}.png`),fullPage:true});
  }
  console.log(JSON.stringify({images:jobs.length,sheets:Math.ceil(jobs.length/16),allDecoded:true,output:directory}));
}finally{await browser.close();}
