// Get DOM elements
const defaultMode = document.getElementById('defaultMode');
const defaultMicrophone = document.getElementById('defaultMicrophone');
const defaultSystemAudio = document.getElementById('defaultSystemAudio');
const videoQuality = document.getElementById('videoQuality');
const maxFrameRate = document.getElementById('maxFrameRate');
const autoDownload = document.getElementById('autoDownload');
const saveBtn = document.getElementById('saveBtn');
const successMessage = document.getElementById('successMessage');

// Default settings
const defaultSettings = {
  defaultMode: 'screen',
  defaultMicrophone: false,
  defaultSystemAudio: false,
  videoQuality: 'medium',
  maxFrameRate: '30',
  autoDownload: true
};

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(defaultSettings, (settings) => {
    defaultMode.value = settings.defaultMode;
    defaultMicrophone.checked = settings.defaultMicrophone;
    defaultSystemAudio.checked = settings.defaultSystemAudio;
    videoQuality.value = settings.videoQuality;
    maxFrameRate.value = settings.maxFrameRate;
    autoDownload.checked = settings.autoDownload;
  });
}

// Save settings
function saveSettings() {
  const settings = {
    defaultMode: defaultMode.value,
    defaultMicrophone: defaultMicrophone.checked,
    defaultSystemAudio: defaultSystemAudio.checked,
    videoQuality: videoQuality.value,
    maxFrameRate: maxFrameRate.value,
    autoDownload: autoDownload.checked
  };

  chrome.storage.local.set(settings, () => {
    // Show success message
    successMessage.classList.add('show');
    
    // Hide message after 3 seconds
    setTimeout(() => {
      successMessage.classList.remove('show');
    }, 3000);
  });
}

// Event listeners
saveBtn.addEventListener('click', saveSettings);

// Load settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);

// Auto-save on change (optional)
[defaultMode, defaultMicrophone, defaultSystemAudio, videoQuality, maxFrameRate, autoDownload].forEach(element => {
  element.addEventListener('change', () => {
    // You can enable auto-save by uncommenting the line below
    // saveSettings();
  });
});
