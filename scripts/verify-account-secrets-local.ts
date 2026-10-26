import { readFile,readdir,writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
async function main(){
  const config=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261024-account-v2/cloudbaserc.json','utf8')).functions[0].envVariables;
  const needles=[config.SESSION_SECRET_B64,config.CSRF_SECRET_B64,config.PROFILE_ENCRYPTION_KEY_B64];
  const directory='.local-data/cloudbase-http/account-ingredients-20261024';
  for(const name of ['fixtures.private.json','initial-password-fixtures.private.json','owner-invitation.private.json']){
    const data=JSON.parse(await readFile(`${directory}/${name}`,'utf8'));
    for(const r of Array.isArray(data)?data:[data])for(const key of ['password','initialPassword'])if(r[key])needles.push(r[key]);
  }
  if(needles.some(v=>typeof v!=='string'||v.length<20))throw Error('SECRET_FIXTURE_INCOMPLETE');
  const {stdout}=await promisify(execFile)('rg',['--files'],{maxBuffer:4*1024*1024});
  const files=stdout.split(/\r?\n/).filter(p=>/\.(?:[cm]?js|tsx?|sql|json|md|css|html|ps1)$/.test(p));
  for(const item of await readdir('build/web/assets'))if(/\.(?:js|css)$/.test(item))files.push(`build/web/assets/${item}`);
  files.push('build/web/index.html');
  const leaked=[];
  for(const file of files){const text=await readFile(file,'utf8');if(needles.some(v=>text.includes(v)))leaked.push(file);}
  if(leaked.length){console.error(JSON.stringify({leakedFiles:leaked}));throw Error('SECRET_LEAK_FOUND');}
  const report={verifiedAt:new Date().toISOString(),textFilesScanned:files.length,secretValuesPrinted:false,matches:0,ignoredPrivateFilesExcluded:true};
  const reportName=process.argv[2]??'secret-boundary-verification.json';
  if(!/^secret-boundary-[a-z0-9-]+\.json$/.test(reportName))throw Error('REPORT_PATH');
  await writeFile(`acceptance/account-ingredients-2026-10-24/${reportName}`,JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify(report));
}
main().catch(()=>{console.error('ACCOUNT_SECRET_BOUNDARY_FAILED');process.exitCode=1;});
