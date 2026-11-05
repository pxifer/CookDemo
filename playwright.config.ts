import { defineConfig } from '@playwright/test';
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4175);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PLAYWRIGHT_PORT');
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  outputDir: 'artifacts/test-results',
  testDir: './tests', testMatch: '**/*.spec.ts', testIgnore: ['**/ui-revision.spec.ts','**/resume.spec.ts','**/cloudbase-preview.spec.ts','**/account-cloud.spec.ts','**/registration-browser.spec.ts','**/registration-live.spec.ts','**/composition-v2-browser.spec.ts','**/health-chat-browser.spec.ts'], fullyParallel: false, workers: 1, retries: 0,
  timeout: 30_000, expect: { timeout: 7000 },
  reporter: [['list'], ['json', { outputFile: `${process.env.ACCEPTANCE_DIR ?? 'artifacts/acceptance'}/browser-results.json` }]],
  use: { baseURL, channel: 'msedge', headless: true, locale: 'zh-CN', reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'retain-on-failure',
    serviceWorkers:'block',proxy:{server:'http://127.0.0.1:9',bypass:'127.0.0.1,localhost,[::1]'} },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: `"${process.execPath}" --import tsx backend/src/main.ts`, url: `${baseURL}/healthz`, reuseExistingServer: false,
    env: { LOCAL_TEST_FEATURES: '1', APP_ENV: 'local', HOST: '127.0.0.1', PORT: String(port), APP_ORIGIN: baseURL, CONTENT_SOURCE: 'constructed' } },
});
