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

let startTime = 0;
let pausedTime = 0;
let timerInterval = null;
let isPaused = false;

// Load saved settings
chrome.storage.sync.get(['captureType', 'audioEnabled', 'micEnabled', 'quality'], (result) => {
  if (result.captureType) captureType.value = result.captureType;
  if (result.audioEnabled !== undefined) audioEnabled.checked = result.audioEnabled;
  if (result.micEnabled !== undefined) micEnabled.checked = result.micEnabled;
  if (result.quality) quality.value = result.quality;
});

// Save settings on change
[captureType, audioEnabled, micEnabled, quality].forEach(element => {
  element.addEventListener('change', () => {
    chrome.storage.sync.set({
      captureType: captureType.value,
      audioEnabled: audioEnabled.checked,
      micEnabled: micEnabled.checked,
      quality: quality.value
    });
  });
});

// Check recording state on popup open
chrome.runtime.sendMessage({ action: 'getRecordingState' }, (response) => {
  if (response && response.isRecording) {
    updateUIForRecording();
    if (response.isPaused) {
      updateUIForPaused();
    }
  }
});

// Start recording
startBtn.addEventListener('click', async () => {
  const options = {
    captureType: captureType.value,
    audioEnabled: audioEnabled.checked,
    micEnabled: micEnabled.checked,
    quality: quality.value
  };

  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'startRecording', 
      options 
    });
    
    if (response && response.success) {
      updateUIForRecording();
      startTimer();
    } else {
      alert('Failed to start recording: ' + (response?.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error starting recording:', error);
    alert('Failed to start recording. Please try again.');
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
  timerElement.textContent = '00:00';
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
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const displaySeconds = seconds % 60;
  timerElement.textContent = 
    `${String(minutes).padStart(2, '0')}:${String(displaySeconds).padStart(2, '0')}`;
}

// UI state management
function updateUIForRecording() {
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
  resumeBtn.style.display = 'none';
  pauseBtn.style.display = 'flex';
  
  statusText.textContent = 'Recording...';
  recordingStatus.classList.add('recording');
  recordingStatus.classList.remove('paused');
  
  // Disable options during recording
  captureType.disabled = true;
  audioEnabled.disabled = true;
  micEnabled.disabled = true;
  quality.disabled = true;
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

function resetUI() {
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resumeBtn.disabled = true;
  stopBtn.disabled = true;
  pauseBtn.style.display = 'flex';
  resumeBtn.style.display = 'none';
  
  statusText.textContent = 'Ready to record';
  recordingStatus.classList.remove('recording', 'paused');
  
  // Re-enable options
  captureType.disabled = false;
  audioEnabled.disabled = false;
  micEnabled.disabled = false;
  quality.disabled = false;
  
  isPaused = false;
}
