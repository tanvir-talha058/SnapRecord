// Get DOM elements
const screenBtn = document.getElementById('screenBtn');
const tabBtn = document.getElementById('tabBtn');
const windowBtn = document.getElementById('windowBtn');
const microphoneCheck = document.getElementById('microphoneCheck');
const systemAudioCheck = document.getElementById('systemAudioCheck');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const statusSection = document.getElementById('statusSection');
const statusText = document.getElementById('statusText');
const timerElement = document.getElementById('timer');
const errorMessage = document.getElementById('errorMessage');

let selectedMode = 'screen';
let isRecording = false;
let isPaused = false;

// Load saved preferences
chrome.storage.local.get(['recordingMode', 'includeMicrophone', 'includeSystemAudio'], (result) => {
  if (result.recordingMode) {
    selectedMode = result.recordingMode;
    updateModeButtons();
  }
  if (result.includeMicrophone !== undefined) {
    microphoneCheck.checked = result.includeMicrophone;
  }
  if (result.includeSystemAudio !== undefined) {
    systemAudioCheck.checked = result.includeSystemAudio;
  }
});

// Check recording state
chrome.runtime.sendMessage({ action: 'getRecordingState' }, (response) => {
  if (response && response.isRecording) {
    isRecording = true;
    isPaused = response.isPaused || false;
    updateUI();
  }
});

// Mode button click handlers
const modeButtons = [screenBtn, tabBtn, windowBtn];
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedMode = btn.dataset.mode;
    updateModeButtons();
    savePreferences();
  });
});

function updateModeButtons() {
  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === selectedMode);
  });
}

// Save preferences
function savePreferences() {
  chrome.storage.local.set({
    recordingMode: selectedMode,
    includeMicrophone: microphoneCheck.checked,
    includeSystemAudio: systemAudioCheck.checked
  });
}

microphoneCheck.addEventListener('change', savePreferences);
systemAudioCheck.addEventListener('change', savePreferences);

// Show error message helper
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
  setTimeout(() => {
    errorMessage.classList.remove('show');
  }, 5000);
}

// Start recording
startBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startRecording',
      mode: selectedMode,
      includeMicrophone: microphoneCheck.checked,
      includeSystemAudio: systemAudioCheck.checked
    });

    if (response && response.success) {
      isRecording = true;
      isPaused = false;
      updateUI();
    } else {
      showError('Failed to start recording: ' + (response?.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error starting recording:', error);
    showError('Failed to start recording. Please try again.');
  }
});

// Stop recording
stopBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'stopRecording' });
    
    if (response && response.success) {
      isRecording = false;
      isPaused = false;
      updateUI();
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
  }
});

// Pause recording
pauseBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'pauseRecording' });
    
    if (response && response.success) {
      isPaused = true;
      updateUI();
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
      isPaused = false;
      updateUI();
    }
  } catch (error) {
    console.error('Error resuming recording:', error);
  }
});

// Update UI based on recording state
function updateUI() {
  if (isRecording) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'flex';
    statusSection.style.display = 'block';
    
    if (isPaused) {
      pauseBtn.style.display = 'none';
      resumeBtn.style.display = 'flex';
      statusText.textContent = 'Paused';
    } else {
      pauseBtn.style.display = 'flex';
      resumeBtn.style.display = 'none';
      statusText.textContent = 'Recording...';
    }
    
    // Disable mode and audio options during recording
    modeButtons.forEach(btn => btn.disabled = true);
    microphoneCheck.disabled = true;
    systemAudioCheck.disabled = true;
  } else {
    startBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'none';
    statusSection.style.display = 'none';
    
    // Enable mode and audio options
    modeButtons.forEach(btn => btn.disabled = false);
    microphoneCheck.disabled = false;
    systemAudioCheck.disabled = false;
  }
}

// Timer update listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateTimer') {
    timerElement.textContent = formatTime(message.seconds);
  } else if (message.action === 'recordingStopped') {
    isRecording = false;
    isPaused = false;
    updateUI();
    timerElement.textContent = '00:00:00';
  }
});

// Format time for timer display
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [hours, minutes, secs]
    .map(val => val.toString().padStart(2, '0'))
    .join(':');
}
