// Recording state
let isRecording = false;
let isPaused = false;
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
          const pauseResult = await pauseRecording();
          sendResponse(pauseResult);
          break;
          
        case 'resumeRecording':
          const resumeResult = await resumeRecording();
          sendResponse(resumeResult);
          break;
          
        case 'stopRecording':
          const stopResult = await stopRecording();
          sendResponse(stopResult);
          break;
          
        case 'recordingStarted':
          // Content script notifies us that recording started
          // Only set recordingStartTime if not already set (avoid resetting timer)
          isContentScriptRecording = true;
          isRecording = true;
          if (!recordingStartTime || recordingStartTime === 0) {
            recordingStartTime = Date.now();
            pausedDuration = 0;
            pauseStartTime = 0;
          }
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
    isRecording = true;
    recordingStartTime = Date.now();
    pausedDuration = 0;
    pauseStartTime = 0;
    
    // Set badge to show recording
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    
    return { success: true };
  } catch (error) {
    console.error('Error starting recording:', error);
    isRecording = false;
    isContentScriptRecording = false;
    return { success: false, error: error.message };
  }
}

// Pause recording
async function pauseRecording() {
async function pauseRecording() {
  if (!recordingTabId) {
    return { success: false, error: 'No active recording tab' };
  }
  
  try {
    const response = await chrome.tabs.sendMessage(recordingTabId, {
      action: 'pauseContentRecording'
    });
    
    if (response && response.success) {
      isPaused = true;
      pauseStartTime = Date.now();
      chrome.action.setBadgeText({ text: '⏸' });
      chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
      return { success: true };
    } else {
      console.log('Pause failed:', response?.error);
      return { success: false, error: response?.error || 'Failed to pause' };
    }
  } catch (err) {
    console.log('Error pausing recording:', err);
    return { success: false, error: err.message };
  }
}

// Resume recording
async function resumeRecording() {
  if (!recordingTabId) {
    return { success: false, error: 'No active recording tab' };
  }
  
  try {
    const response = await chrome.tabs.sendMessage(recordingTabId, {
      action: 'resumeContentRecording'
    });
    
    if (response && response.success) {
      // Add the paused time to the total paused duration
      if (pauseStartTime > 0) {
        pausedDuration += Date.now() - pauseStartTime;
        pauseStartTime = 0;
      }
      isPaused = false;
      chrome.action.setBadgeText({ text: 'REC' });
      chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      return { success: true };
    } else {
      console.log('Resume failed:', response?.error);
      return { success: false, error: response?.error || 'Failed to resume' };
    }
  } catch (err) {
    console.log('Error resuming recording:', err);
    return { success: false, error: err.message };
  }
}

// Stop recording
async function stopRecording() {
  const tabId = recordingTabId;
  
  // Reset state first
  isContentScriptRecording = false;
  isRecording = false;
  isPaused = false;
  recordingTabId = null;
  recordingStartTime = 0;
  pausedDuration = 0;
  pauseStartTime = 0;
  
  chrome.action.setBadgeText({ text: '' });
  
  if (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'stopContentRecording'
      });
      return { success: true };
    } catch (err) {
      console.log('Error stopping content script recording:', err);
      return { success: true }; // Still return success as recording is stopped
    }
  }
  
  return { success: true };
}

// Clean up on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  if (isRecording) {
    stopRecording();
  }
});

// Keyboard shortcut handlers
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-recording') {
    if (isRecording) {
      await stopRecording();
    } else {
      // Load saved settings and start recording
      const settings = await chrome.storage.sync.get([
        'captureType', 'audioEnabled', 'micEnabled', 'quality',
        'cameraEnabled', 'cameraPosition', 'cameraSize', 'cameraShape',
        'frameRate', 'format'
      ]);
      
      const options = {
        captureType: settings.captureType || 'screen',
        audioEnabled: settings.audioEnabled !== false,
        micEnabled: settings.micEnabled || false,
        quality: settings.quality || '1080',
        cameraEnabled: settings.cameraEnabled || false,
        cameraPosition: settings.cameraPosition || 'bottom-right',
        cameraSize: settings.cameraSize || 'medium',
        cameraShape: settings.cameraShape || 'circle',
        frameRate: settings.frameRate || '30',
        format: settings.format || 'webm-vp9'
      };
      
      await startRecording(options);
    }
  } else if (command === 'pause-resume') {
    if (isRecording) {
      if (isPaused) {
        await resumeRecording();
      } else {
        await pauseRecording();
      }
    }
  }
});
