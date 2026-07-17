// Shared Playwright fixtures for SnapRecord's extension e2e tests.
const fs = require('fs');
const os = require('os');
const path = require('path');
const base = require('@playwright/test');
const { chromium } = require('@playwright/test');
const { buildTestExtension } = require('./build-test-extension');
const { startLocalPageServer } = require('./local-page-server');

const test = base.test.extend({
  // A local page to record, served over HTTP so tests don't need network access.
  // Playwright's fixture system requires the literal `{}` destructuring
  // pattern here (it statically parses this signature for dependencies).
  // eslint-disable-next-line no-empty-pattern
  targetPage: async ({}, use) => {
    const server = await startLocalPageServer();
    await use(server);
    await server.close();
  },

  // Launches the extension (built fresh from current source) in a real
  // Chromium with its capture/media prompts auto-approved, and tears
  // everything down afterward.
  extensionContext: async ({ targetPage }, use) => {
    const extensionDir = buildTestExtension({ testOrigin: targetPage.origin });
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snaprecord-e2e-profile-'));

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
        '--auto-select-desktop-capture-source=Entire screen',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--no-first-run'
      ]
    });

    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }

    await use({ context, serviceWorker, extensionDir });

    await context.close();
    fs.rmSync(extensionDir, { recursive: true, force: true });
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  // A real page navigated to the local target, made the active tab.
  recordablePage: async ({ extensionContext, targetPage }, use) => {
    const page = await extensionContext.context.newPage();
    await page.goto(targetPage.url, { waitUntil: 'load' });
    await page.bringToFront();
    // Give Chrome's tab-activation state a moment to settle before any
    // background.js call that queries the active tab.
    await page.waitForTimeout(500);
    await use(page);
  },

  // Convenience handle for calling background.js functions directly, the
  // same way popup.js reaches them via chrome.runtime.sendMessage.
  background: async ({ extensionContext }, use) => {
    const sw = extensionContext.serviceWorker;
    await use({
      call: (fn, arg) => sw.evaluate(fn, arg),

      activeTabId: async () => {
        const tabs = await sw.evaluate(() => chrome.tabs.query({ active: true, currentWindow: true }));
        return tabs[0].id;
      },

      // Reads state that only exists in content.js's isolated JS world
      // (invisible to page.evaluate, which runs in the main world).
      getContentScriptState: async (tabId) => {
        const [{ result }] = await sw.evaluate(
          (tid) => chrome.scripting.executeScript({
            target: { tabId: tid },
            world: 'ISOLATED',
            func: () => {
              const stream = window.__debugScreenStream;
              return {
                streamEverCreated: !!stream,
                streamTracks: stream
                  ? stream.getTracks().map((t) => ({ kind: t.kind, readyState: t.readyState }))
                  : null,
                recorderIsNull: window.__snapRecordMediaRecorder === null ||
                  window.__snapRecordMediaRecorder === undefined
              };
            }
          }),
          tabId
        );
        return result;
      }
    });
  }
});

module.exports = { test, expect: base.expect };
