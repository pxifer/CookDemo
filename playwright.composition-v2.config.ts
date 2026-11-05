import {defineConfig} from '@playwright/test';
import base from './playwright.cloudbase.config';
export default defineConfig({...base,testMatch:'**/composition-v2-browser.spec.ts',testIgnore:[],outputDir:'artifacts/acceptance/composition-v2-2026-10-24/browser',reporter:[['list'],['json',{outputFile:'artifacts/acceptance/composition-v2-2026-10-24/browser-results.json'}]],use:{...base.use,trace:'off'}});
