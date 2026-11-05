import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const evidence=process.env.HEALTH_CHAT_ACCEPTANCE_DIR??'artifacts/acceptance/health-chat-2026-10-27';
const port=Number(process.env.HEALTH_CHAT_TEST_PORT??4198);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('HEALTH_CHAT_TEST_PORT_INVALID');
export default defineConfig({...base,testMatch:'**/health-chat-browser.spec.ts',testIgnore:[],timeout:60000,
  outputDir:`${evidence}/browser`,
  reporter:[['list'],['json',{outputFile:`${evidence}/browser-results.json`}]],
  use:{...base.use,baseURL:`http://127.0.0.1:${port}`,trace:'off'},
  webServer:{command:`"${process.execPath}" --import tsx tests/health-chat-server.ts`,url:`http://127.0.0.1:${port}/healthz`,reuseExistingServer:false,env:{HEALTH_CHAT_E2E:'1',HEALTH_CHAT_TEST_PORT:String(port)}},
});
