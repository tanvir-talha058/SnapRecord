// Builds a throwaway copy of the extension for e2e testing.
//
// Two additions are made on top of the real, current source (never a
// hand-maintained duplicate, so this can't silently drift from what ships):
//
// 1. "tabs" + host_permissions for the local test server are added to the
//    manifest. Real users grant activeTab by clicking the toolbar icon,
//    which Chrome recognizes as a trusted gesture; Playwright's scripted
//    calls into background.js bypass that gesture entirely, so without
//    this the extension can't see tab URLs or inject content.js at all.
//    This does NOT change what's shipped — only this test copy.
// 2. A single non-invasive line after the getDisplayMedia call in
//    content.js exposes the resulting MediaStream on `window` for
//    inspection. Content scripts run in an isolated JS world, invisible
//    to Playwright's page.evaluate, so without this hook there is no way
//    to observe whether a capture stream actually stopped.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EXTENSION_FILES } = require('../../../scripts/extension-files');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const GET_DISPLAY_MEDIA_ANCHOR =
  'currentStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);';

/**
 * Copies the real extension into a fresh temp directory with test-only
 * manifest permissions and a debug stream hook applied.
 * @param {{ testOrigin: string }} opts - Origin to grant host_permissions for.
 * @returns {string} Path to the built extension directory.
 */
function buildTestExtension({ testOrigin }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snaprecord-e2e-'));

  for (const relPath of EXTENSION_FILES) {
    const src = path.join(REPO_ROOT, relPath);
    const dest = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.permissions.includes('tabs')) {
    manifest.permissions.push('tabs');
  }
  manifest.host_permissions = [`${testOrigin}/*`];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const contentPath = path.join(dir, 'content.js');
  const contentSrc = fs.readFileSync(contentPath, 'utf8');
  if (!contentSrc.includes(GET_DISPLAY_MEDIA_ANCHOR)) {
    throw new Error(
      'build-test-extension: expected getDisplayMedia assignment not found in content.js — ' +
      'update GET_DISPLAY_MEDIA_ANCHOR to match the current source.'
    );
  }
  const patchedContent = contentSrc.replace(
    GET_DISPLAY_MEDIA_ANCHOR,
    `${GET_DISPLAY_MEDIA_ANCHOR}\n        window.__debugScreenStream = currentStream; // e2e-only observability hook`
  );
  fs.writeFileSync(contentPath, patchedContent);

  return dir;
}

module.exports = { buildTestExtension, REPO_ROOT };
