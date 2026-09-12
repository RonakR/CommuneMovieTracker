import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    headless: true,
    launchOptions: existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }
      : {}
  },
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    env: { DEMO_MODE: 'true', DEMO_DATA_FILE: '.data/browser-tests.json' },
    reuseExistingServer: false,
    timeout: 30000
  },
  reporter: 'list'
});
