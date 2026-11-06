import {defineConfig} from '@playwright/test';
import base from './playwright.config';
// Dedicated loopback port avoids Windows excluded range around default 4175.
const port=15201,origin=`http://127.0.0.1:${port}`;
export default defineConfig({...base,testMatch:['**/browser.spec.ts','**/photo-input.spec.ts'],webServer:{command:`"${process.execPath}" --import tsx backend/src/main.ts`,url:`${origin}/healthz`,reuseExistingServer:false,env:{LOCAL_TEST_FEATURES:'1',APP_ENV:'local',HOST:'127.0.0.1',PORT:String(port),APP_ORIGIN:origin,CONTENT_SOURCE:'constructed'}},use:{...base.use,baseURL:origin}});
