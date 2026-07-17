// Playwright config for SnapRecord's Chrome extension e2e suite.
// Separate from Jest's unit tests (npm test) — these launch a real
// Chromium with the unpacked extension loaded, so they're slower and
// need a display (headless extension loading is unreliable across
// Chromium versions). Run with: npm run test:e2e
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30000,
  // Each test launches a real headed Chromium with the desktop-capture
  // picker auto-selected — running two at once seems to make that OS-level
  // picker state interfere across processes, so keep this suite serial.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure'
  }
});
