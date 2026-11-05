import { createApp } from '../backend/src/app';
import { fixture } from './registration-fixture';
import { CloudBaseAccounts } from '../backend/src/cloudbase-accounts';
import { resolve } from 'node:path';
if(process.env.REGISTRATION_E2E_TEST!=='1')throw Error('TEST_SERVER_DISABLED');
const {db,options}=await fixture();const accounts=new CloudBaseAccounts({...options,recoveryEnabled:true});
const app=await createApp({accounts,origin:'http://127.0.0.1:4178',environment:'local',staticRoot:resolve('artifacts/build/web')});
await app.listen({host:'127.0.0.1',port:4178});
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>void app.close().then(()=>db.close()));
