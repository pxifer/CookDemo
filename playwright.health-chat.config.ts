import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:'**/health-chat-browser.spec.ts',testIgnore:[],timeout:60000,
  outputDir:'acceptance/health-chat-2026-10-27/browser',
  reporter:[['list'],['json',{outputFile:'acceptance/health-chat-2026-10-27/browser-results.json'}]],
  use:{...base.use,baseURL:'http://127.0.0.1:4198',trace:'off'},
  webServer:{command:`"${process.execPath}" --import tsx tests/health-chat-server.ts`,url:'http://127.0.0.1:4198/healthz',reuseExistingServer:false,env:{HEALTH_CHAT_E2E:'1'}},
});
