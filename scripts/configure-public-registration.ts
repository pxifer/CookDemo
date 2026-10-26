import { readFile,writeFile } from 'node:fs/promises';
async function main(){
  const path='.local-data/cloudbase-http/release-20261024-account-v4/cloudbaserc.json';
  const config=JSON.parse(await readFile(path,'utf8')),old=JSON.parse(await readFile('.local-data/cloudbase-http/release-20261024-account-v3/cloudbaserc.json','utf8'));
  const evidence=JSON.parse(await readFile('acceptance/public-registration-2026-10-24/provider-configuration.json','utf8'));
  if(config.envId!=='shiwei-d2gmiun66b7dc6a4f'||config.functions.length!==1||config.functions[0].name!=='shiwei-http-preview'||!evidence.emailLogin||!evidence.builtInMail||evidence.enableOverrun!==false)throw Error('CONFIGURATION_NOT_VERIFIED');
  const env=config.functions[0].envVariables;
  for(const [key,value] of Object.entries(old.functions[0].envVariables))if(env[key]!==value)throw Error('EXISTING_CONFIGURATION_CHANGED');
  env.PUBLIC_REGISTRATION_ENABLED='1';
  await writeFile(path,JSON.stringify(config,null,2),{mode:0o600});
  console.log(JSON.stringify({publicRegistrationEnabled:true,allExistingConfigurationPreserved:true,keysPreserved:true,compositionReleasePreserved:true,secretsPrinted:false}));
}
main().catch(()=>{console.error('PUBLIC_REGISTRATION_RELEASE_FAILED');process.exitCode=1;});
