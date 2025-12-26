// Recording state
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let isPaused = false;
let recordingStartTime = null;
let pausedDuration = 0;
let lastPauseTime = null;
let timerInterval = null;
let currentStream = null;

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRecording') {
    startRecording(message.mode, message.includeMicrophone, message.includeSystemAudio)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  } else if (message.action === 'stopRecording') {
    stopRecording()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.action === 'pauseRecording') {
    pauseRecording();
    sendResponse({ success: true });
  } else if (message.action === 'resumeRecording') {
    resumeRecording();
    sendResponse({ success: true });
  } else if (message.action === 'getRecordingState') {
    sendResponse({ isRecording, isPaused });
  }
});

// Start recording function
async function startRecording(mode, includeMicrophone, includeSystemAudio) {
  try {
    // Reset state
    recordedChunks = [];
    isRecording = true;
    isPaused = false;

    // Get screen stream based on mode
    let screenStream;
    
    if (mode === 'tab') {
      // For tab capture, we need to get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      screenStream = await chrome.tabCapture.capture({
        audio: includeSystemAudio,
        video: true
      });
    } else {
      // For screen or window capture, use desktopCapture
      screenStream = await getDesktopStream(mode, includeSystemAudio);
    }

    if (!screenStream) {
      throw new Error('Failed to get screen stream');
    }

    // Get microphone stream if requested
    let audioStream = null;
    if (includeMicrophone) {
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          } 
        });
      } catch (error) {
        console.warn('Could not get microphone access:', error);
      }
    }

    // Combine streams
    let tracks = [];
    
    // Add video track from screen
    const videoTracks = screenStream.getVideoTracks();
    if (videoTracks.length > 0) {
      tracks.push(videoTracks[0]);
    }

    // Add audio tracks
    const screenAudioTracks = screenStream.getAudioTracks();
    if (screenAudioTracks.length > 0) {
      tracks.push(screenAudioTracks[0]);
    }

    if (audioStream) {
      const micAudioTracks = audioStream.getAudioTracks();
      if (micAudioTracks.length > 0) {
        tracks.push(micAudioTracks[0]);
      }
    }

    // Create combined stream
    currentStream = new MediaStream(tracks);

    // Set up MediaRecorder
    const options = {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
    };

    // Fallback to vp8 if vp9 is not supported
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8,opus';
    }

    mediaRecorder = new MediaRecorder(currentStream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      saveRecording();
      cleanup();
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      cleanup();
    };

    // Start recording
    mediaRecorder.start(1000); // Collect data every second

    // Start timer
    recordingStartTime = Date.now();
    pausedDuration = 0;
    lastPauseTime = null;
    startTimer();

    console.log('Recording started successfully');
  } catch (error) {
    console.error('Error starting recording:', error);
    cleanup();
    throw error;
  }
}

// Get desktop stream using desktopCapture API
function getDesktopStream(mode, includeSystemAudio) {
  return new Promise((resolve, reject) => {
    const sources = mode === 'screen' ? ['screen'] : ['window'];
    
    chrome.desktopCapture.chooseDesktopMedia(sources, (streamId) => {
      if (!streamId) {
        reject(new Error('User cancelled screen sharing'));
        return;
      }

      navigator.mediaDevices.getUserMedia({
        audio: includeSystemAudio ? {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        } : false,
        video: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId,
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 30 }
        }
      })
      .then(stream => resolve(stream))
      .catch(error => reject(error));
    });
  });
}

// Stop recording
async function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  isRecording = false;
  isPaused = false;
  
  // Notify popup
  chrome.runtime.sendMessage({ action: 'recordingStopped' }).catch(() => {
    // Popup might be closed, ignore error
  });
  
  stopTimer();
}

// Pause recording
function pauseRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    isPaused = true;
    lastPauseTime = Date.now();
    stopTimer();
  }
}

// Resume recording
function resumeRecording() {
  if (mediaRecorder && mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    isPaused = false;
    if (lastPauseTime) {
      pausedDuration += Date.now() - lastPauseTime;
      lastPauseTime = null;
    }
    startTimer();
  }
}

// Timer functions
function startTimer() {
  stopTimer(); // Clear any existing timer
  
  timerInterval = setInterval(() => {
    if (!isPaused) {
      const totalElapsed = Date.now() - recordingStartTime;
      const activeTime = totalElapsed - pausedDuration;
      const elapsed = Math.floor(activeTime / 1000);
      chrome.runtime.sendMessage({ 
        action: 'updateTimer', 
        seconds: elapsed 
      }).catch(() => {
        // Popup might be closed, ignore error
      });
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Save recording
function saveRecording() {
  if (recordedChunks.length === 0) {
    console.warn('No recording data to save');
    return;
  }

  // Create blob from recorded chunks
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);

  // Generate filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `SnapRecord_${timestamp}.webm`;

  // Download the file
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Download error:', chrome.runtime.lastError);
    } else {
      console.log('Recording saved:', filename);
    }
  });
}

// Cleanup function
function cleanup() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  
  mediaRecorder = null;
  recordedChunks = [];
  isRecording = false;
  isPaused = false;
  pausedDuration = 0;
  lastPauseTime = null;
  
  stopTimer();
}

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
  chrome.action.openPopup();
});

console.log('SnapRecord background service worker loaded');
