// UI Elements
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');
const timerElement = document.getElementById('timer');
const recordingStatus = document.getElementById('recordingStatus');
const captureType = document.getElementById('captureType');
const audioEnabled = document.getElementById('audioEnabled');
const micEnabled = document.getElementById('micEnabled');
const quality = document.getElementById('quality');
const cameraEnabled = document.getElementById('cameraEnabled');
const cameraSettings = document.getElementById('cameraSettings');
const cameraPosition = document.getElementById('cameraPosition');
const cameraSize = document.getElementById('cameraSize');
const frameRate = document.getElementById('frameRate');
const format = document.getElementById('format');
const fileSizeEstimate = document.getElementById('fileSizeEstimate');
const resolutionPreview = document.getElementById('resolutionPreview');
const micSettings = document.getElementById('micSettings');

let startTime = 0;
let pausedTime = 0;
let timerInterval = null;
let isPaused = false;

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active from all tabs and contents
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // Add active to clicked tab and corresponding content
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// Get camera shape from radio buttons
function getCameraShape() {
  const selected = document.querySelector('input[name="cameraShape"]:checked');
  return selected ? selected.value : 'circle';
}

// Set camera shape radio buttons
function setCameraShape(value) {
  const radio = document.querySelector(`input[name="cameraShape"][value="${value}"]`);
  if (radio) radio.checked = true;
}

// Load saved settings
chrome.storage.sync.get([
  'captureType', 'audioEnabled', 'micEnabled', 'quality', 
  'cameraEnabled', 'cameraPosition', 'cameraSize', 'cameraShape',
  'frameRate', 'format'
], (result) => {
  if (result.captureType) captureType.value = result.captureType;
  if (result.audioEnabled !== undefined) audioEnabled.checked = result.audioEnabled;
  if (result.micEnabled !== undefined) micEnabled.checked = result.micEnabled;
  if (result.quality) quality.value = result.quality;
  if (result.cameraEnabled !== undefined) {
    cameraEnabled.checked = result.cameraEnabled;
    cameraSettings.style.display = result.cameraEnabled ? 'block' : 'none';
  }
  if (result.cameraPosition) cameraPosition.value = result.cameraPosition;
  if (result.cameraSize) cameraSize.value = result.cameraSize;
  if (result.cameraShape) setCameraShape(result.cameraShape);
  if (result.frameRate) frameRate.value = result.frameRate;
  if (result.format) format.value = result.format;
  
  updateQualityPreview();
});

// Save all settings
function saveSettings() {
  chrome.storage.sync.set({
    captureType: captureType.value,
    audioEnabled: audioEnabled.checked,
    micEnabled: micEnabled.checked,
    quality: quality.value,
    cameraEnabled: cameraEnabled.checked,
    cameraPosition: cameraPosition.value,
    cameraSize: cameraSize.value,
    cameraShape: getCameraShape(),
    frameRate: frameRate.value,
    format: format.value
  });
}

// Save settings on change for all elements
[captureType, audioEnabled, micEnabled, quality, cameraPosition, cameraSize, frameRate, format].forEach(element => {
  element.addEventListener('change', () => {
    saveSettings();
    updateQualityPreview();
  });
});

// Shape radio buttons
document.querySelectorAll('input[name="cameraShape"]').forEach(radio => {
  radio.addEventListener('change', saveSettings);
});

// Toggle camera settings visibility
cameraEnabled.addEventListener('change', () => {
  cameraSettings.style.display = cameraEnabled.checked ? 'block' : 'none';
  saveSettings();
});

// Toggle mic settings visibility
micEnabled.addEventListener('change', () => {
  micSettings.style.display = micEnabled.checked ? 'block' : 'none';
  saveSettings();
});

// Update quality preview
function updateQualityPreview() {
  const resolutions = {
    '480': { width: 854, height: 480, size: 5 },
    '720': { width: 1280, height: 720, size: 10 },
    '1080': { width: 1920, height: 1080, size: 15 },
    '1440': { width: 2560, height: 1440, size: 25 },
    '2160': { width: 3840, height: 2160, size: 50 }
  };
  
  const frameRateMultipliers = {
    '24': 0.8,
    '30': 1,
    '60': 1.8
  };
  
  const formatMultipliers = {
    'webm-vp9': 1,
    'webm-vp8': 1.2,
    'webm-h264': 1.1,
    'mp4': 1.1,
    'gif': 3
  };
  
  const res = resolutions[quality.value] || resolutions['1080'];
  const fpsMulti = frameRateMultipliers[frameRate.value] || 1;
  const formatMulti = formatMultipliers[format.value] || 1;
  
  const estimatedSize = Math.round(res.size * fpsMulti * formatMulti);
  
  fileSizeEstimate.textContent = `~${estimatedSize} MB`;
  resolutionPreview.textContent = `${res.width} × ${res.height}`;
}

// Check recording state on popup open
chrome.runtime.sendMessage({ action: 'getRecordingState' }, (response) => {
  if (response && response.isRecording) {
    updateUIForRecording();
    if (response.isPaused) {
      updateUIForPaused();
    }
  }
});

// SVG Icons for buttons
const ICONS = {
  record: '<svg class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>',
  loading: '<svg class="btn-icon spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>',
  pause: '<svg class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  play: '<svg class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  stop: '<svg class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>'
};

// Start recording
startBtn.addEventListener('click', async () => {
  const options = {
    captureType: captureType.value,
    audioEnabled: audioEnabled.checked,
    micEnabled: micEnabled.checked,
    quality: quality.value,
    cameraEnabled: cameraEnabled.checked,
    cameraPosition: cameraPosition.value,
    cameraSize: cameraSize.value,
    cameraShape: getCameraShape(),
    frameRate: frameRate.value,
    format: format.value
  };

  try {
    startBtn.disabled = true;
    startBtn.innerHTML = ICONS.loading + '<span class="btn-text">Starting...</span>';
    
    const response = await chrome.runtime.sendMessage({ 
      action: 'startRecording', 
      options 
    });
    
    if (response && response.success) {
      updateUIForRecording();
      startTimer();
    } else {
      alert('Failed to start recording: ' + (response?.error || 'Unknown error'));
      startBtn.disabled = false;
      startBtn.innerHTML = ICONS.record + '<span class="btn-text">Start Recording</span>';
    }
  } catch (error) {
    console.error('Error starting recording:', error);
    alert('Failed to start recording. Please try again.');
    startBtn.disabled = false;
    startBtn.innerHTML = ICONS.record + '<span class="btn-text">Start Recording</span>';
  }
});

// Pause recording
pauseBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'pauseRecording' });
    if (response && response.success) {
      updateUIForPaused();
    }
  } catch (error) {
    console.error('Error pausing recording:', error);
  }
});

// Resume recording
resumeBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'resumeRecording' });
    if (response && response.success) {
      updateUIForResumed();
    }
  } catch (error) {
    console.error('Error resuming recording:', error);
  }
});

// Stop recording
stopBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'stopRecording' });
    if (response && response.success) {
      resetUI();
      stopTimer();
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
  }
});

// Timer functions
function startTimer() {
  startTime = Date.now() - pausedTime;
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  pausedTime = 0;
  timerElement.textContent = '00:00:00';
}

function pauseTimer() {
  clearInterval(timerInterval);
  pausedTime = Date.now() - startTime;
}

function resumeTimer() {
  startTimer();
}

function updateTimer() {
  const elapsed = Date.now() - startTime;
  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  timerElement.textContent = 
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// UI state management
function updateUIForRecording() {
  startBtn.disabled = true;
  startBtn.innerHTML = ICONS.record + '<span class="btn-text">Recording...</span>';
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
  resumeBtn.style.display = 'none';
  pauseBtn.style.display = 'flex';
  
  statusText.textContent = 'Recording...';
  recordingStatus.classList.add('recording');
  recordingStatus.classList.remove('paused');
  
  // Disable all options during recording
  setOptionsDisabled(true);
}

function updateUIForPaused() {
  pauseBtn.style.display = 'none';
  resumeBtn.style.display = 'flex';
  resumeBtn.disabled = false;
  
  statusText.textContent = 'Paused';
  recordingStatus.classList.remove('recording');
  recordingStatus.classList.add('paused');
  
  pauseTimer();
  isPaused = true;
}

function updateUIForResumed() {
  resumeBtn.style.display = 'none';
  pauseBtn.style.display = 'flex';
  pauseBtn.disabled = false;
  
  statusText.textContent = 'Recording...';
  recordingStatus.classList.add('recording');
  recordingStatus.classList.remove('paused');
  
  resumeTimer();
  isPaused = false;
}

function setOptionsDisabled(disabled) {
  captureType.disabled = disabled;
  audioEnabled.disabled = disabled;
  micEnabled.disabled = disabled;
  quality.disabled = disabled;
  cameraEnabled.disabled = disabled;
  cameraPosition.disabled = disabled;
  cameraSize.disabled = disabled;
  frameRate.disabled = disabled;
  format.disabled = disabled;
  
  // Disable shape radio buttons
  document.querySelectorAll('input[name="cameraShape"]').forEach(radio => {
    radio.disabled = disabled;
  });
  
  // Disable tab navigation during recording
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.disabled = disabled;
    btn.style.pointerEvents = disabled ? 'none' : 'auto';
    btn.style.opacity = disabled ? '0.5' : '1';
  });
}

function resetUI() {
  startBtn.disabled = false;
  startBtn.innerHTML = ICONS.record + '<span class="btn-text">Start Recording</span>';
  pauseBtn.disabled = true;
  resumeBtn.disabled = true;
  stopBtn.disabled = true;
  pauseBtn.style.display = 'flex';
  resumeBtn.style.display = 'none';
  
  statusText.textContent = 'Ready to record';
  recordingStatus.classList.remove('recording', 'paused');
  
  // Re-enable all options
  setOptionsDisabled(false);
  
  isPaused = false;
}
