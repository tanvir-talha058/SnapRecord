// Recording state
let isRecording = false;
let isPaused = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let recordingTabId = null;
let isContentScriptRecording = false;

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'getRecordingState':
          sendResponse({ isRecording, isPaused });
          break;
          
        case 'startRecording':
          const result = await startRecording(request.options);
          sendResponse(result);
          break;
          
        case 'pauseRecording':
          await pauseRecording();
          sendResponse({ success: true });
          break;
          
        case 'resumeRecording':
          await resumeRecording();
          sendResponse({ success: true });
          break;
          
        case 'stopRecording':
          await stopRecording();
          sendResponse({ success: true });
          break;
          
        case 'recordingStarted':
          // Content script notifies us that recording started
          isContentScriptRecording = true;
          isRecording = true;
          chrome.action.setBadgeText({ text: 'REC' });
          chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // Keep the message channel open for async response
});

// Start recording function
async function startRecording(options) {
  try {
    if (isRecording) {
      return { success: false, error: 'Already recording' };
    }

    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    recordingTabId = tab.id;

    // For tab recording, use tabCapture directly in background
    if (options.captureType === 'tab') {
      const stream = await chrome.tabCapture.capture({
        audio: options.audioEnabled,
        video: true,
        videoConstraints: {
          mandatory: {
            minWidth: 1280,
            minHeight: 720,
            maxWidth: options.quality === '1440' ? 2560 : options.quality === '1080' ? 1920 : 1280,
            maxHeight: options.quality === '1440' ? 1440 : options.quality === '1080' ? 1080 : 720,
          }
        }
      });
      
      if (!stream) {
        throw new Error('Failed to capture tab');
      }
      
      await initializeRecorder(stream, options);
      isContentScriptRecording = false;
      return { success: true };
    } else {
      // For screen/window capture, use content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (err) {
        // Script might already be injected, continue
        console.log('Content script injection:', err.message);
      }
      
      // Request display media through content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'startCapture',
        captureType: options.captureType,
        options: options
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to start screen/window capture');
      }
      
      // Content script will handle the recording
      isContentScriptRecording = true;
      return { success: true };
    }
  } catch (error) {
    console.error('Error starting recording:', error);
    isRecording = false;
    isContentScriptRecording = false;
    return { success: false, error: error.message };
  }
}

// Initialize MediaRecorder
async function initializeRecorder(stream, options) {
  recordedChunks = [];
  recordingStream = stream;
  
  // Create MediaRecorder
  const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
    ? 'video/webm; codecs=vp9'
    : 'video/webm';
  
  mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: options.quality === '1440' ? 8000000 : 
                       options.quality === '1080' ? 5000000 : 2500000
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    await saveRecording();
    // Stop all tracks
    if (recordingStream) {
      recordingStream.getTracks().forEach(track => track.stop());
      recordingStream = null;
    }
  };

  mediaRecorder.start(1000); // Capture data every second
  isRecording = true;
  isPaused = false;

  // Update badge
  chrome.action.setBadgeText({ text: 'REC' });
  chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
}

// Pause recording
async function pauseRecording() {
  if (isContentScriptRecording && recordingTabId) {
    // Send pause command to content script
    await chrome.tabs.sendMessage(recordingTabId, {
      action: 'pauseContentRecording'
    });
    isPaused = true;
  } else if (mediaRecorder && isRecording && !isPaused) {
    mediaRecorder.pause();
    isPaused = true;
  }
  
  chrome.action.setBadgeText({ text: '⏸' });
  chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
}

// Resume recording
async function resumeRecording() {
  if (isContentScriptRecording && recordingTabId) {
    // Send resume command to content script
    await chrome.tabs.sendMessage(recordingTabId, {
      action: 'resumeContentRecording'
    });
    isPaused = false;
  } else if (mediaRecorder && isRecording && isPaused) {
    mediaRecorder.resume();
    isPaused = false;
  }
  
  chrome.action.setBadgeText({ text: 'REC' });
  chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
}

// Stop recording
async function stopRecording() {
  if (isContentScriptRecording && recordingTabId) {
    // Send stop command to content script
    try {
      await chrome.tabs.sendMessage(recordingTabId, {
        action: 'stopContentRecording'
      });
    } catch (err) {
      console.log('Error stopping content script recording:', err);
    }
    isContentScriptRecording = false;
  } else if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
  }
  
  isRecording = false;
  isPaused = false;
  recordingTabId = null;
  
  // Clear badge
  chrome.action.setBadgeText({ text: '' });
}

// Save recording
async function saveRecording() {
  if (recordedChunks.length === 0) {
    console.error('No recorded data');
    return;
  }

  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  
  // Generate filename with timestamp
  const date = new Date();
  const filename = `SnapRecord_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}.webm`;
  
  // Download the file
  await chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
  
  // Clean up
  recordedChunks = [];
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Clean up on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  if (isRecording) {
    stopRecording();
  }
});
