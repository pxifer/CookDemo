import { defineConfig } from '@playwright/test';
import baseline from './playwright.config';
const port=Number(process.env.UI_BROWSER_PORT??4176);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid UI browser port');
export default defineConfig({...baseline,testMatch:'**/ui-revision.spec.ts',testIgnore:[],webServer:undefined,
  outputDir:'test-results/ui-revision',use:{...baseline.use,baseURL:`http://127.0.0.1:${port}`},
  reporter:[['list'],['json',{outputFile:`${process.env.ACCEPTANCE_DIR??'acceptance/ui-revision-2026-10-22'}/browser-results.json`}]],
});
