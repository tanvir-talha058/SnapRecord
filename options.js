// DOM Elements
const defaultCaptureType = document.getElementById('defaultCaptureType');
const defaultQuality = document.getElementById('defaultQuality');
const defaultAudioEnabled = document.getElementById('defaultAudioEnabled');
const defaultMicEnabled = document.getElementById('defaultMicEnabled');
const fileFormat = document.getElementById('fileFormat');
const autoSave = document.getElementById('autoSave');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const openShortcutsBtn = document.getElementById('openShortcuts');
const statusMessage = document.getElementById('statusMessage');

// Default settings
const defaultSettings = {
  captureType: 'tab',
  quality: '1080',
  audioEnabled: true,
  micEnabled: false,
  fileFormat: 'webm',
  autoSave: false
};

// Load settings
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (result) => {
    defaultCaptureType.value = result.captureType;
    defaultQuality.value = result.quality;
    defaultAudioEnabled.checked = result.audioEnabled;
    defaultMicEnabled.checked = result.micEnabled;
    fileFormat.value = result.fileFormat;
    autoSave.checked = result.autoSave;
  });
}

// Save settings
function saveSettings() {
  const settings = {
    captureType: defaultCaptureType.value,
    quality: defaultQuality.value,
    audioEnabled: defaultAudioEnabled.checked,
    micEnabled: defaultMicEnabled.checked,
    fileFormat: fileFormat.value,
    autoSave: autoSave.checked
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

// Auto-save on change (optional)
[defaultCaptureType, defaultQuality, defaultAudioEnabled, defaultMicEnabled, fileFormat, autoSave].forEach(element => {
  element.addEventListener('change', () => {
    // Optionally auto-save
    // saveSettings();
  });
});

// Load settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);
