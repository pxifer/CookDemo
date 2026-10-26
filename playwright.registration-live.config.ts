import { defineConfig } from '@playwright/test';
import base from './playwright.cloudbase.config';
export default defineConfig({...base,testMatch:'**/registration-live.spec.ts',testIgnore:[],
  outputDir:`${process.env.REGISTRATION_LIVE_DIR??'acceptance/public-registration-2026-10-24'}/live`,
  reporter:[['list'],['json',{outputFile:`${process.env.REGISTRATION_LIVE_DIR??'acceptance/public-registration-2026-10-24'}/live-results.json`}]],
  use:{...base.use,trace:'off'},
});
