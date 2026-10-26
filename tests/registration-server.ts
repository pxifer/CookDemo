import { createApp } from '../server/app';
import { fixture } from './registration-fixture';
import { resolve } from 'node:path';
if(process.env.REGISTRATION_E2E_TEST!=='1')throw Error('TEST_SERVER_DISABLED');
const {db,accounts}=await fixture();
const app=await createApp({accounts,origin:'http://127.0.0.1:4178',environment:'local',staticRoot:resolve('build/web')});
await app.listen({host:'127.0.0.1',port:4178});
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>void app.close().then(()=>db.close()));
