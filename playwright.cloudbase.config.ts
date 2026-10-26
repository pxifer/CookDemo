import { defineConfig } from '@playwright/test';
import baseline from './playwright.config';
export default defineConfig({...baseline,testMatch:'**/cloudbase-preview.spec.ts',testIgnore:[],webServer:undefined,timeout:60000,expect:{timeout:18000},
  outputDir:`${process.env.CLOUD_ACCEPTANCE_DIR??'acceptance/cloudbase-http-2026-10-23'}/browser`,reporter:[['list'],['json',{outputFile:`${process.env.CLOUD_ACCEPTANCE_DIR??'acceptance/cloudbase-http-2026-10-23'}/browser-results.json`}]],
  use:{...baseline.use,baseURL:'https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com'},
});
