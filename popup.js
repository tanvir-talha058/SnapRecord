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
const countdownSeconds = document.getElementById('countdownSeconds');
const fileSizeEstimate = document.getElementById('fileSizeEstimate');
const resolutionPreview = document.getElementById('resolutionPreview');
const micSettings = document.getElementById('micSettings');
const annotationsEnabled = document.getElementById('annotationsEnabled');

const errorBanner = document.getElementById('errorBanner');

let startTime = 0;
let pausedTime = 0;
let timerInterval = null;
let pollInterval = null;
let errorTimeout = null;

/**
 * Shows an error message inside the popup instead of a blocking alert.
 * @param {string} message - The message to display.
 */
function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
  if (errorTimeout) clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => {
    errorBanner.hidden = true;
  }, 6000);
}

// Listen for recording state changes from background
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.action === 'recordingStateChanged') {
    if (message.state.isRecording && message.state.recordingStartTime > 0) {
      const now = Date.now();
      const elapsed = now - message.state.recordingStartTime - (message.state.pausedDuration || 0);
      startTime = now - elapsed;
      pausedTime = 0;
      
      statusText.textContent = 'Recording...';
      updateUIForRecording();
      updateTimer();
      
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      timerInterval = setInterval(updateTimer, 1000);
      
      // Clear any polling
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }
  }
});

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active from all tabs and contents
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Add active to clicked tab and corresponding content
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// Get camera shape from radio buttons
/**
 * Retrieves the currently selected camera shape.
 * @returns {string} The selected shape value.
 */
function getCameraShape() {
  const selected = document.querySelector('input[name="cameraShape"]:checked');
  return selected ? selected.value : 'circle';
}

// Set camera shape radio buttons
/**
 * Sets the camera shape radio button programmatically.
 * @param {string} value - The shape value to select.
 */
function setCameraShape(value) {
  const radio = document.querySelector(`input[name="cameraShape"][value="${value}"]`);
  if (radio) radio.checked = true;
}

// Load saved settings
chrome.storage.sync.get([
  'captureType', 'audioEnabled', 'micEnabled', 'quality',
  'cameraEnabled', 'cameraPosition', 'cameraSize', 'cameraShape',
  'frameRate', 'format', 'countdownSeconds', 'annotationsEnabled'
], (result) => {
  if (result.captureType) captureType.value = result.captureType;
  if (result.audioEnabled !== undefined) audioEnabled.checked = result.audioEnabled;
  if (result.micEnabled !== undefined) {
    micEnabled.checked = result.micEnabled;
    micSettings.style.display = result.micEnabled ? 'block' : 'none';
    if (result.micEnabled) {
      populateMicrophoneDevices();
    }
  }
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
  if (result.countdownSeconds !== undefined) countdownSeconds.value = result.countdownSeconds;
  if (result.annotationsEnabled !== undefined) annotationsEnabled.checked = result.annotationsEnabled;
  else annotationsEnabled.checked = true; // Default to enabled

  updateQualityPreview();
});

// Save all settings
/**
 * Saves all current UI settings to synchronized storage.
 */
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
    format: format.value,
    countdownSeconds: countdownSeconds.value,
    annotationsEnabled: annotationsEnabled.checked
  });
}

// Save settings on change for all elements
[captureType, audioEnabled, micEnabled, quality, cameraPosition, cameraSize, frameRate, format, countdownSeconds, annotationsEnabled].forEach(element => {
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
  if (micEnabled.checked) {
    populateMicrophoneDevices();
  }
  saveSettings();
});

// Populate microphone devices
const micDevice = document.getElementById('micDevice');

/**
 * Populates the microphone selection dropdown with available audio input devices.
 */
async function populateMicrophoneDevices() {
  try {
    // Request permission first to get device labels
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');

    micDevice.innerHTML = '<option value="default">Default Microphone</option>';

    audioInputs.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${index + 1}`;
      micDevice.appendChild(option);
    });

    // Load saved device
    chrome.storage.sync.get(['micDeviceId'], (result) => {
      if (result.micDeviceId) {
        micDevice.value = result.micDeviceId;
      }
    });
  } catch (error) {
    console.warn('Could not enumerate microphones:', error);
  }
}

// Save mic device selection
micDevice.addEventListener('change', () => {
  chrome.storage.sync.set({ micDeviceId: micDevice.value });
});

// Update quality preview
/**
 * Updates the file size estimation and resolution preview based on selected settings.
 */
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
  if (chrome.runtime.lastError) {
    console.warn('Error getting recording state:', chrome.runtime.lastError);
    return;
  }

  if (response && response.isRecording) {
    updateUIForRecording();

    // Restore timer from background state
    if (response.recordingStartTime && response.recordingStartTime > 0) {
      const now = Date.now();
      const elapsed = now - response.recordingStartTime - (response.pausedDuration || 0);
      startTime = now - elapsed;
      pausedTime = 0;

      // Update timer display immediately
      updateTimer();
      
      statusText.textContent = response.isPaused ? 'Paused' : 'Recording...';

      if (response.isPaused) {
        updateUIForPaused();
        pausedTime = elapsed; // Store for resume
      } else {
        // Start the timer interval
        if (timerInterval) {
          clearInterval(timerInterval);
        }
        timerInterval = setInterval(updateTimer, 1000);
      }
    } else {
      // Recording is starting (countdown in progress), show "Starting..." state
      statusText.textContent = 'Starting...';
      timerElement.textContent = '00:00:00';
      // Poll for actual recording start
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      pollInterval = setInterval(() => {
        chrome.runtime.sendMessage({ action: 'getRecordingState' }, (pollResponse) => {
          if (chrome.runtime.lastError) {
            console.warn('Polling error:', chrome.runtime.lastError);
            return;
          }
          if (pollResponse && pollResponse.recordingStartTime > 0) {
            clearInterval(pollInterval);
            pollInterval = null;
            const now = Date.now();
            const elapsed = now - pollResponse.recordingStartTime - (pollResponse.pausedDuration || 0);
            startTime = now - elapsed;
            pausedTime = 0;
            
            // Update UI immediately
            statusText.textContent = 'Recording...';
            updateTimer();
            
            // Start timer interval if not paused
            if (!pollResponse.isPaused) {
              if (timerInterval) {
                clearInterval(timerInterval);
              }
              timerInterval = setInterval(updateTimer, 1000);
            }
          } else if (!pollResponse || !pollResponse.isRecording) {
            // Recording was cancelled
            clearInterval(pollInterval);
            pollInterval = null;
          }
        });
      }, 200);
    }
  }
});

// SVG Icons for the start button states
const ICONS = {
  record: '<svg class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>',
  loading: '<svg class="btn-icon spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>'
};

// Start recording
startBtn.addEventListener('click', async () => {
  // Check if the current tab is a valid page for recording
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = (tab && tab.url) || '';
  if (!tab || !tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:') || tabUrl.startsWith('chrome-extension://')) {
    showError('Browser pages can\'t be recorded. Open a regular webpage and try again.');
    return;
  }

  const options = {
    captureType: captureType.value,
    audioEnabled: audioEnabled.checked,
    micEnabled: micEnabled.checked,
    micDeviceId: micDevice.value,
    quality: quality.value,
    cameraEnabled: cameraEnabled.checked,
    cameraPosition: cameraPosition.value,
    cameraSize: cameraSize.value,
    cameraShape: getCameraShape(),
    frameRate: frameRate.value,
    format: format.value,
    countdownSeconds: parseInt(countdownSeconds.value) || 0,
    annotationsEnabled: annotationsEnabled.checked
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
      statusText.textContent = 'Starting...';
      timerElement.textContent = '00:00:00';

      // Poll for actual recording start (after countdown completes)
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      pollInterval = setInterval(() => {
        chrome.runtime.sendMessage({ action: 'getRecordingState' }, (pollResponse) => {
          if (chrome.runtime.lastError) {
            console.warn('Polling error:', chrome.runtime.lastError);
            return;
          }
          if (pollResponse && pollResponse.recordingStartTime > 0) {
            clearInterval(pollInterval);
            pollInterval = null;
            // Calculate elapsed time accounting for any paused duration
            const now = Date.now();
            const elapsed = now - pollResponse.recordingStartTime - (pollResponse.pausedDuration || 0);
            startTime = now - elapsed;
            pausedTime = 0;
            
            // Update UI immediately
            statusText.textContent = 'Recording...';
            updateTimer();
            
            // Start the timer interval
            if (timerInterval) {
              clearInterval(timerInterval);
            }
            timerInterval = setInterval(updateTimer, 1000);
          } else if (!pollResponse || !pollResponse.isRecording) {
            // Recording was cancelled or failed
            clearInterval(pollInterval);
            pollInterval = null;
            resetUI();
          }
        });
      }, 200);
    } else {
      showError(response?.error || 'Recording didn\'t start. Try again.');
      startBtn.disabled = false;
      startBtn.innerHTML = ICONS.record + '<span class="btn-text">Start Recording</span>';
    }
  } catch (error) {
    console.error('Error starting recording:', error);
    showError('Recording didn\'t start. Refresh the page and try again.');
    startBtn.disabled = false;
    startBtn.innerHTML = ICONS.record + '<span class="btn-text">Start Recording</span>';
  }
});

// Pause recording
pauseBtn.addEventListener('click', async () => {
  try {
    pauseBtn.disabled = true;
    const response = await chrome.runtime.sendMessage({ action: 'pauseRecording' });
    if (response && response.success) {
      updateUIForPaused();
    } else {
      console.error('Pause failed:', response?.error);
      pauseBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error pausing recording:', error);
    pauseBtn.disabled = false;
  }
});

// Resume recording
resumeBtn.addEventListener('click', async () => {
  try {
    resumeBtn.disabled = true;
    const response = await chrome.runtime.sendMessage({ action: 'resumeRecording' });
    if (response && response.success) {
      updateUIForResumed();
    } else {
      console.error('Resume failed:', response?.error);
      resumeBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error resuming recording:', error);
    resumeBtn.disabled = false;
  }
});

// Stop recording
stopBtn.addEventListener('click', async () => {
  try {
    stopBtn.disabled = true;
    const response = await chrome.runtime.sendMessage({ action: 'stopRecording' });
    if (response && response.success) {
      resetUI();
      stopTimer();
    } else {
      console.error('Stop failed:', response?.error);
      stopBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
    stopBtn.disabled = false;
  }
});

// Timer functions
/**
 * Starts the recording timer.
 */
function startTimer() {
  // Clear any existing timer first
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  startTime = Date.now() - pausedTime;
  updateTimer(); // Update immediately
  timerInterval = setInterval(updateTimer, 1000);
}

/**
 * Stops and resets the recording timer.
 */
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  pausedTime = 0;
  timerElement.textContent = '00:00:00';
}

/**
 * Pauses the recording timer.
 */
function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  pausedTime = Date.now() - startTime;
}

function resumeTimer() {
  startTimer();
}

/**
 * Updates the timer display element with the elapsed time.
 */
function updateTimer() {
  if (!startTime || startTime <= 0) return;
  const totalSeconds = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  timerElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// UI state management
/**
 * Updates the UI elements to reflect the recording state.
 */
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
}

function updateUIForResumed() {
  resumeBtn.style.display = 'none';
  pauseBtn.style.display = 'flex';
  pauseBtn.disabled = false;

  statusText.textContent = 'Recording...';
  recordingStatus.classList.add('recording');
  recordingStatus.classList.remove('paused');

  resumeTimer();
}

/**
 * Enables or disables validation options during recording.
 * @param {boolean} disabled - Whether options should be disabled.
 */
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
  annotationsEnabled.disabled = disabled;
  micDevice.disabled = disabled;
  countdownSeconds.disabled = disabled;

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

/**
 * Resets the UI to the initial ready state.
 */
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
}
