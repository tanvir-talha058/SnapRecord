// Import utility functions
importScripts('utils.js');

// Recording state
let isRecording = false;
let isPaused = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let recordingTabId = null;
let isContentScriptRecording = false;
let recordingStartTime = 0;
let pausedDuration = 0;
let pauseStartTime = 0;

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'getRecordingState':
          sendResponse({ 
            isRecording, 
            isPaused, 
            recordingStartTime,
            pausedDuration: isPaused ? pausedDuration + (Date.now() - pauseStartTime) : pausedDuration
          });
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
          recordingStartTime = Date.now();
          pausedDuration = 0;
          pauseStartTime = 0;
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
    
    // Check if we can inject into this tab
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      throw new Error('Cannot record browser internal pages. Please navigate to a regular webpage.');
    }
    
    recordingTabId = tab.id;

    // Ensure content script is injected and ready
    // First try to ping the content script to see if it's already loaded
    let contentScriptReady = false;
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      contentScriptReady = pingResponse && pingResponse.ready;
    } catch (err) {
      // Content script not loaded yet, need to inject
      contentScriptReady = false;
    }
    
    // If content script is not ready, inject it
    if (!contentScriptReady) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        // Wait for script to initialize
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error('Content script injection error:', err);
        throw new Error('Failed to inject content script. Make sure you are on a regular webpage.');
      }
    }
    
    // Request display media through content script with retry
    let response;
    let retries = 5;
    let lastError;
    while (retries > 0) {
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          action: 'startCapture',
          captureType: options.captureType,
          options: options
        });
        if (response) break;
      } catch (err) {
        lastError = err;
        console.log(`Retry ${6 - retries}/5 - Content script communication failed:`, err.message);
      }
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    if (!response) {
      throw new Error(lastError?.message || 'Failed to communicate with content script. Please refresh the page and try again.');
    }
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to start capture');
    }
    
    // Content script will handle the recording
    isContentScriptRecording = true;
    return { success: true };
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
  if (recordingTabId) {
    // Send pause command to content script
    try {
      await chrome.tabs.sendMessage(recordingTabId, {
        action: 'pauseContentRecording'
      });
      isPaused = true;
      pauseStartTime = Date.now();
    } catch (err) {
      console.log('Error pausing recording:', err);
    }
  }
  
  chrome.action.setBadgeText({ text: '⏸' });
  chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
}

// Resume recording
async function resumeRecording() {
  if (recordingTabId) {
    // Send resume command to content script
    try {
      await chrome.tabs.sendMessage(recordingTabId, {
        action: 'resumeContentRecording'
      });
      // Add the paused time to the total paused duration
      if (pauseStartTime > 0) {
        pausedDuration += Date.now() - pauseStartTime;
        pauseStartTime = 0;
      }
      isPaused = false;
    } catch (err) {
      console.log('Error resuming recording:', err);
    }
  }
  
  chrome.action.setBadgeText({ text: 'REC' });
  chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
}

// Stop recording
async function stopRecording() {
  if (recordingTabId) {
    // Send stop command to content script (handles both recording and camera cleanup)
    try {
      await chrome.tabs.sendMessage(recordingTabId, {
        action: 'stopContentRecording'
      });
    } catch (err) {
      console.log('Error stopping content script recording:', err);
    }
  }
  
  isContentScriptRecording = false;
  isRecording = false;
  isPaused = false;
  recordingTabId = null;
  recordingStartTime = 0;
  pausedDuration = 0;
  pauseStartTime = 0;
  
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
  const filename = generateRecordingFilename();
  
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
