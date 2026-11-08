const { defineConfig, devices } = require('@playwright/test');

// Bundled Chromium is the portable default. Use a local Chromium explicitly when
// browser downloads are unavailable (e.g. PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1280, height: 800 },
      launchOptions: executablePath ? { executablePath } : {},
    },
  }],
  webServer: {
    command: 'node scripts/serve.cjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 15_000,
    env: { PORT: '4173' },
  },
});
