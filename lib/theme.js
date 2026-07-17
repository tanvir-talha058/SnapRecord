// Shared light/dark theme handling for all extension pages.
// Default is light (day mode). The choice is stored in chrome.storage.sync
// and applied as data-theme on <html>; open pages follow changes live via
// storage events.
(function (global) {
  'use strict';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  async function toggleTheme() {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try {
      await chrome.storage.sync.set({ theme: next });
    } catch (_e) {
      // Storage unavailable; the visual toggle still applies to this page.
    }
    return next;
  }

  // Apply the stored theme as soon as this script loads, and keep the page
  // in sync when the theme is changed from another extension page.
  try {
    chrome.storage.sync.get({ theme: 'light' }, (result) => {
      applyTheme(result.theme);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.theme) {
        applyTheme(changes.theme.newValue);
      }
    });
  } catch (_e) {
    applyTheme('light');
  }

  global.SnapRecordTheme = { applyTheme, currentTheme, toggleTheme };
})(typeof self !== 'undefined' ? self : globalThis);
