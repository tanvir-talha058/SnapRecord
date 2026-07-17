// DOM Elements
const defaultCaptureType = document.getElementById('defaultCaptureType');
const defaultQuality = document.getElementById('defaultQuality');
const defaultAudioEnabled = document.getElementById('defaultAudioEnabled');
const defaultMicEnabled = document.getElementById('defaultMicEnabled');
const fileFormat = document.getElementById('fileFormat');
const previewCount = document.getElementById('previewCount');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const openShortcutsBtn = document.getElementById('openShortcuts');
const statusMessage = document.getElementById('statusMessage');

// Only offer MP4 when the browser can actually record it (Chrome 126+).
if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4')) {
  const mp4Option = document.createElement('option');
  mp4Option.value = 'mp4';
  mp4Option.textContent = 'MP4 — most compatible';
  fileFormat.appendChild(mp4Option);
}

// Default settings — same storage keys the popup and background use
const defaultSettings = {
  captureType: 'screen',
  quality: '1080',
  audioEnabled: true,
  micEnabled: false,
  format: 'webm-vp9',
  previewCount: '3'
};

// Load settings
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (result) => {
    defaultCaptureType.value = result.captureType;
    defaultQuality.value = result.quality;
    defaultAudioEnabled.checked = result.audioEnabled;
    defaultMicEnabled.checked = result.micEnabled;
    fileFormat.value = Array.from(fileFormat.options).some((o) => o.value === result.format)
      ? result.format
      : 'webm-vp9';
    previewCount.value = result.previewCount;
  });
}

// Save settings
function saveSettings() {
  const settings = {
    captureType: defaultCaptureType.value,
    quality: defaultQuality.value,
    audioEnabled: defaultAudioEnabled.checked,
    micEnabled: defaultMicEnabled.checked,
    format: fileFormat.value,
    previewCount: previewCount.value
  };

  chrome.storage.sync.set(settings, () => {
    showStatus('Settings saved successfully!', 'success');
  });
}

// Reset settings
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    chrome.storage.sync.set(defaultSettings, () => {
      loadSettings();
      showStatus('Settings reset to defaults', 'success');
    });
  }
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  
  setTimeout(() => {
    statusMessage.className = 'status-message';
  }, 3000);
}

// Open keyboard shortcuts
function openShortcuts() {
  chrome.tabs.create({
    url: 'chrome://extensions/shortcuts'
  });
}

// Event listeners
saveBtn.addEventListener('click', saveSettings);
resetBtn.addEventListener('click', resetSettings);
openShortcutsBtn.addEventListener('click', openShortcuts);

// Load settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);
