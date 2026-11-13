import {defineConfig} from '@playwright/test';
import base from './playwright.config';
const origin='http://127.0.0.1:15203';
export default defineConfig({...base,testMatch:'**/recipe1000-browser.spec.ts',timeout:60000,reporter:[['list'],['json',{outputFile:'.local-data/recipe1000-browser/results.json'}]],use:{...base.use,baseURL:origin},webServer:{command:`"${process.execPath}" --import tsx scripts/preview-recipe-1000.ts`,url:`${origin}/healthz`,reuseExistingServer:false}});
