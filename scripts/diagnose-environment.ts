import { mkdir,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { acceptanceEnvironment } from './lib/acceptance-environment';
const result=await acceptanceEnvironment();
const out=resolve(process.env.PROJECT_ACCEPTANCE_DIR??`artifacts/acceptance/environment-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(out,{recursive:true});await writeFile(join(out,'environment.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,report:join(out,'environment.json')},null,2));
