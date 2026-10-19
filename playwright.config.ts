import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1, retries: 0,
  timeout: 30_000, expect: { timeout: 7000 },
  reporter: [['list'], ['json', { outputFile: `${process.env.ACCEPTANCE_DIR ?? 'acceptance'}/browser-results.json` }]],
  use: { baseURL: 'http://127.0.0.1:4175', channel: 'msedge', headless: true, locale: 'zh-CN', reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: `"${process.execPath}" --import tsx server/main.ts`, url: 'http://127.0.0.1:4175/healthz', reuseExistingServer: !process.env.CI },
});
