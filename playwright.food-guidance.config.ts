import {defineConfig} from '@playwright/test';
import base from './playwright.health-chat.config';
const evidence=process.env.HEALTH_CHAT_ACCEPTANCE_DIR??'artifacts/acceptance/business-rag-2026-11-04/research-browser';
export default defineConfig({...base,testMatch:'**/food-guidance.browser.ts',
  outputDir:`${evidence}/browser`,
  reporter:[['list'],['json',{outputFile:`${evidence}/browser-results.json`}]],
  webServer:{...base.webServer as any,env:{...(base.webServer as any).env,HEALTH_GUIDANCE_RESEARCH_E2E:'1'}},
});
