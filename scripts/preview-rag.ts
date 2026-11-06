import {readImageModelConfig} from '../backend/src/image-recognition';
/** Explicit local preview: cached public recipes, research PG, ephemeral local accounts.
 * Generation uses the user's own UI-supplied key and the existing fixed DeepSeek adapter.
 * This entry never reads evaluation keys and never starts an automatic model request.
 */
import {readFile} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createApp} from '../backend/src/app';
import {verifyGalleryBundle,type GalleryBundle,recipeAssetOrigin} from '../backend/src/cloudbase-content';
import {createLocalFoodGuidanceProvider} from '../backend/src/rag/food-guidance-repository';
import {fixture} from '../tests/registration-fixture';
import {localPreviewBudget} from './lib/local-preview-budget';

if(process.env.LOCAL_RAG_PREVIEW!=='1'||process.versions.node.split('.')[0]!=='24')throw Error('EXPLICIT_NODE24_LOCAL_PREVIEW_REQUIRED');
if(process.env.SHIWEI_LOCAL_TEST_ONLY==='1')throw Error('REAL_PREVIEW_CANNOT_USE_OFFLINE_TEST_ENVIRONMENT');
const port=Number(process.env.LOCAL_RAG_PREVIEW_PORT??15199);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('LOCAL_PREVIEW_PORT_INVALID');
const origin=`http://127.0.0.1:${port}`,directory='.local-data/cloudbase-http/listed-foods-20261026-v28';
const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
const bundle=JSON.parse(await readFile(join(directory,'gallery-bundle.json'),'utf8')) as GalleryBundle;
const snapshot=verifyGalleryBundle(bundle,manifest.hash);
const rows=bundle.rows.map(row=>({...row,image_url:row.image_url?.startsWith(recipeAssetOrigin)?row.image_url.slice(recipeAssetOrigin.length):row.image_url}));
const foodGuidance=await createLocalFoodGuidanceProvider();
const {db,accounts}=await fixture();
const live=process.env.LOCAL_RAG_PREVIEW_BUDGET==='1'?localPreviewBudget():undefined;
// Dedicated ephemeral identity, no real email, no preset model key.
const code=await accounts.registrationCode!('rag-preview@example.invalid','preview-bootstrap');
await accounts.register!({username:'rag-preview',password:'RagPreview!2026',code:'123456',challenge:code.challenge},'preview-bootstrap');
const app=await createApp({imageModel:readImageModelConfig(process.env),environment:'local',origin,accounts,foodGuidance,
  healthRecipeFetch:live?.fetch,
  healthRecipeObserve:live?diagnostic=>appendFileSync('.local-data/rag-preview/selection-observations.jsonl',JSON.stringify(diagnostic)+'\n'):undefined,
  contentSource:'local-cache',contentRelease:snapshot.contentVersion,
  contentRepository:{load:async()=>snapshot,candidates:async()=>rows},
  staticRoot:resolve('artifacts/build/web'),
});
const baseHtml=await readFile('artifacts/build/web/index.html','utf8');
const html=baseHtml.replace('</head>','<link rel="stylesheet" href="/__local-preview.css"></head>').replace('<body>','<body><aside class="local-preview-note">本地研究预览：公开缓存菜谱＋本机知识库；选菜使用你保存的 Key 真实调用 DeepSeek。账户仅本进程有效，停止后清空。</aside>');
app.get('/__local-preview.css',async(_req,reply)=>reply.type('text/css').send('.local-preview-note{padding:12px 20px;background:#fff2cb;color:#51411a;text-align:center;font:14px/1.6 sans-serif}'));
app.addHook('onSend',async(req,reply,payload)=>{
  const pagePath=req.url.split('?')[0];
  if(pagePath==='/'||pagePath==='/index.html'){
    if(payload&&typeof payload==='object'&&'destroy' in payload)(payload as {destroy():void}).destroy();
    reply.header('Content-Length',Buffer.byteLength(html));return html;
  }
  return payload;
});
app.addHook('onClose',async()=>{await foodGuidance.close?.();await db.close();});
await app.listen({host:'127.0.0.1',port});
console.log(JSON.stringify({url:origin,recipes:snapshot.recipes.length,knowledge:'local research PG',generation:'real user-initiated DeepSeek',automaticCalls:0,accounts:'ephemeral local fixture; not cloud identity'}));
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>void app.close());
