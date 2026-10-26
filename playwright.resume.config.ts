import { defineConfig } from '@playwright/test';
import baseline from './playwright.ui.config';
export default defineConfig({...baseline,testMatch:'**/resume.spec.ts',outputDir:'test-results/resume',
  reporter:[['list'],['json',{outputFile:'acceptance/resume-2026-10-23/browser-results.json'}]],
});
