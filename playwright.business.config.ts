import { defineConfig } from '@playwright/test';
import baseline from './playwright.config';
const port = Number(process.env.BUSINESS_BROWSER_PORT ?? 4181);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid business browser port');
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({ ...baseline, testMatch:'**/business-browser.spec.ts',
  outputDir:'test-results/business-chain',
  reporter:[['list'],['json',{outputFile:`${process.env.ACCEPTANCE_DIR ?? 'acceptance/business-chain'}/business-browser-results.json`}]],
  use:{...baseline.use,baseURL},
  webServer:{command:`"${process.execPath}" --env-file=.local-data/deployment/business-local.env --import tsx server/main.ts`,url:`${baseURL}/healthz`,reuseExistingServer:false,
    env:{APP_ENV:'local',HOST:'127.0.0.1',PORT:String(port),APP_ORIGIN:baseURL,CONTENT_SOURCE:'database',CONTENT_RELEASE_ID:'local-business-v1',LOCAL_TEST_FEATURES:'0'}},
});
