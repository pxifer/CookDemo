import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:'**/registration-browser.spec.ts',testIgnore:[],timeout:60000,
  outputDir:`acceptance/public-registration-2026-10-24/${process.env.REGISTRATION_TEST_RUN??'browser'}`,
  reporter:[['list'],['json',{outputFile:`acceptance/public-registration-2026-10-24/${process.env.REGISTRATION_TEST_RUN??'browser'}-results.json`}]],
  use:{...base.use,baseURL:'http://127.0.0.1:4178',trace:'off'},
  webServer:{command:`"${process.execPath}" --import tsx tests/registration-server.ts`,url:'http://127.0.0.1:4178/healthz',reuseExistingServer:false,env:{REGISTRATION_E2E_TEST:'1'}},
});
