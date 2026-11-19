// Browser tests (tests/e2e/). The web server builds the site with the test
// fixture pages (tests/fixtures/leaderboard-pages.ts) into dist-test/ and
// previews it, so `npx playwright test` needs no separate build step.
//
// Playwright's own Chromium is used by default (`npx playwright install
// chromium`). Set CHROMIUM_PATH to use a browser already on the machine.
import { defineConfig, devices } from '@playwright/test';

const port = 4399;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
      },
    },
  ],
  webServer: {
    command: `npx astro build && npx astro preview --port ${port}`,
    env: { LEADERBOARD_TEST_FIXTURES: '1' },
    url: `http://localhost:${port}/test-fixtures/leaderboard/short/`,
    // Never reuse a server: one started by hand may be serving a build
    // without the fixture pages.
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
