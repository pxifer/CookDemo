import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, join } from 'node:path';

async function main(){
  const directory=resolve('.local-data/cloudbase-http/release-20261023');
  const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
  const key=JSON.parse(await readFile('.local-data/cloudbase-http/publishable-key.json','utf8')).data.ApiKey;
  if(typeof key!=='string'||!key)throw Error('PUBLISHABLE_KEY_MISSING');
  const config={envId:'shiwei-d2gmiun66b7dc6a4f',region:'ap-shanghai',functions:[{
    name:manifest.functionName,type:'HTTP',runtime:'Nodejs24.11',handler:'index.main',timeout:60,memorySize:256,
    installDependency:false,dir:'./function',public:true,gatewayPath:'/',
    envVariables:{APP_ORIGIN:manifest.origin,CLOUDBASE_ENV_ID:'shiwei-d2gmiun66b7dc6a4f',CLOUDBASE_PUBLISHABLE_KEY:key,
      CONTENT_BUNDLE_ID:manifest.releaseId,CONTENT_BUNDLE_SHA256:manifest.hash,
      SESSION_SECRET_B64:randomBytes(32).toString('base64'),CSRF_SECRET_B64:randomBytes(32).toString('base64'),LOCAL_TEST_FEATURES:'0'},
  }]};
  await writeFile(join(directory,'cloudbaserc.json'),JSON.stringify(config,null,2),{flag:'wx',mode:0o600});
  await writeFile(join(directory,'function/index.js'),"require('./http-main.cjs');\n",{flag:'wx'});
  console.log(JSON.stringify({configured:true,environmentId:config.envId,function:manifest.functionName,runtime:'Nodejs24.11',publicRecipeReadOnly:true,secretValuesPrinted:false}));
}
main().catch(()=>{console.error('HTTP_PREVIEW_CONFIG_FAILED');process.exitCode=1;});

