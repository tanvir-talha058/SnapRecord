// Single source of truth for "what ships as the extension" — every runtime
// file manifest.json references, plus LICENSE. Used by the release
// packager (scripts/package-extension.js) and the e2e test-extension
// builder (tests/e2e/support/build-test-extension.js) so the two can never
// drift apart: what's tested is exactly what's packaged.
const EXTENSION_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html', 'popup.css', 'popup.js',
  'options.html', 'options.css', 'options.js',
  'history.html', 'history.css', 'history.js',
  'storage-bridge.html', 'storage-bridge.js',
  'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png',
  'lib/recording-db.js', 'lib/webm-duration-fix.js', 'lib/theme.js',
  'LICENSE'
];

module.exports = { EXTENSION_FILES };
