// Verifies the actual release artifact (dist/snaprecord-v<version>.zip)
// is a valid, loadable Chrome extension — not the dev source tree, not a
// scratch copy with test-only permissions added, but the exact zip a user
// would download from a GitHub Release and extract.
//
// Requires `npm run package` to have been run first.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, expect } = require('@playwright/test');
const { chromium } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8'));
const ZIP_PATH = path.join(REPO_ROOT, 'dist', `snaprecord-v${manifest.version}.zip`);

test('the packaged release zip loads as a valid extension with no errors', async () => {
  test.skip(!fs.existsSync(ZIP_PATH), `${path.relative(REPO_ROOT, ZIP_PATH)} not built — run "npm run package" first`);

  // Extract with Node's zlib-free unzip via a plain child process call to
  // keep this test dependency-free beyond what's already installed.
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snaprecord-pkg-check-'));
  const { execFileSync } = require('child_process');
  execFileSync('powershell', [
    '-NoProfile', '-Command',
    `Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${extractDir}' -Force`
  ]);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snaprecord-pkg-profile-'));
  const consoleErrors = [];

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extractDir}`,
      `--load-extension=${extractDir}`,
      '--no-first-run'
    ]
  });

  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }
    expect(serviceWorker.url()).toContain('/background.js');

    const extensionId = new URL(serviceWorker.url()).host;

    const popup = await context.newPage();
    popup.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    popup.on('pageerror', (err) => consoleErrors.push(String(err)));

    await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'load' });
    await expect(popup.locator('#startBtn')).toBeVisible();
    await expect(popup.locator('#stopBtn')).toBeVisible();

    const options = await context.newPage();
    options.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await options.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'load' });
    await expect(options.locator('#saveBtn')).toBeVisible();

    const history = await context.newPage();
    history.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await history.goto(`chrome-extension://${extensionId}/history.html`, { waitUntil: 'load' });
    await expect(history.locator('#clearAllBtn')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  } finally {
    await context.close();
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
