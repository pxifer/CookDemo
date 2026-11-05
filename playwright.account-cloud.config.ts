import { defineConfig } from '@playwright/test';
import base from './playwright.cloudbase.config';
export default defineConfig({...base,testMatch:'**/account-cloud.spec.ts',timeout:120000,expect:{timeout:20000},
  outputDir:`artifacts/acceptance/account-ingredients-2026-10-24/${process.env.ACCOUNT_TEST_RUN??'browser'}`,
  reporter:[['list'],['json',{outputFile:`artifacts/acceptance/account-ingredients-2026-10-24/${process.env.ACCOUNT_TEST_RUN??'browser'}-results.json`}]],
  use:{...base.use,trace:'off'},
});
