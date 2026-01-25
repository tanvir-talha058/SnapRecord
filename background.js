// State management
/**
 * Initial state of the recording session.
 * @typedef {Object} RecordingState
 * @property {boolean} isRecording - Whether a recording is currently active.
 * @property {boolean} isPaused - Whether the recording is currently paused.
 * @property {number|null} recordingTabId - The ID of the tab being recorded.
 * @property {boolean} isContentScriptRecording - Whether the content script has started the MediaRecorder.
 * @property {number} recordingStartTime - Timestamp when recording started.
 * @property {number} pausedDuration - Total time in milliseconds that the recording has been paused.
 * @property {number} pauseStartTime - Timestamp when the current pause started.
 */
const initialState = {
  isRecording: false,
  isPaused: false,
  recordingTabId: null,
  isContentScriptRecording: false,
  recordingStartTime: 0,
  pausedDuration: 0,
  pauseStartTime: 0
};

/**
 * Initializes the extension state from local storage.
 * If no state exists, it sets the initial state.
 * If a recording was active but the tab is gone, it resets the state.
 */
async function initializeState() {
  const { recordingState } = await chrome.storage.local.get('recordingState');
  if (!recordingState) {
    await chrome.storage.local.set({ recordingState: initialState });
  } else {
    // Check if we were recording and if the tab still exists
    if (recordingState.isRecording && recordingState.recordingTabId) {
      try {
        await chrome.tabs.get(recordingState.recordingTabId);
      } catch (_e) {
        // Tab no longer exists, reset state
        console.warn('Recording tab missing, resetting state');
        await chrome.storage.local.set({ recordingState: initialState });
      }
    }
  }
}

/**
 * Retrieves the current recording state from local storage.
 * @returns {Promise<RecordingState>} The current state object.
 */
async function getState() {
  const { recordingState } = await chrome.storage.local.get('recordingState');
  return recordingState || initialState;
}

/**
 * Updates the recording state in local storage.
 * @param {Partial<RecordingState>} updates - The partial state to merge.
 * @returns {Promise<RecordingState>} The updated state object.
 */
async function updateState(updates) {
  const currentState = await getState();
  const newState = { ...currentState, ...updates };
  await chrome.storage.local.set({ recordingState: newState });
  return newState;
}

// Initialize on install/startup
chrome.runtime.onInstalled.addListener(initializeState);
chrome.runtime.onStartup.addListener(initializeState);

/**
 * Handles messages from other parts of the extension (popup, content scripts).
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      const state = await getState();

      switch (request.action) {
        case 'getRecordingState': {
          const responseState = {
            ...state,
            pausedDuration: state.isPaused ? state.pausedDuration + (Date.now() - state.pauseStartTime) : state.pausedDuration
          };
          console.log('getRecordingState response:', responseState);
          sendResponse(responseState);
          break;
        }

        case 'startRecording': {
          const result = await startRecording(request.options);
          sendResponse(result);
          break;
        }

        case 'pauseRecording': {
          const pauseResult = await pauseRecording();
          sendResponse(pauseResult);
          break;
        }

        case 'resumeRecording': {
          const resumeResult = await resumeRecording();
          sendResponse(resumeResult);
          break;
        }

        case 'stopRecording': {
          const stopResult = await stopRecording();
          sendResponse(stopResult);
          break;
        }

        case 'recordingStarted': {
          // Content script notifies us that recording actually started (after countdown)
          const newState = await updateState({
            isContentScriptRecording: true,
            isRecording: true,
            recordingStartTime: Date.now(),
            pausedDuration: 0,
            pauseStartTime: 0
          });
          
          console.log('Recording started, new state:', newState);

          // Broadcast to popup that recording has started
          try {
            chrome.runtime.sendMessage({
              action: 'recordingStateChanged',
              state: newState
            }).catch(() => {
              // Popup might not be open, ignore error
            });
          } catch (_e) {
            // Ignore - popup might not be open
          }

          await chrome.action.setBadgeText({ text: 'REC' });
          await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
          sendResponse({ success: true });
          break;
        }

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

/**
 * Initiates the recording process.
 * Check for active tab, injects content script if needed, and sends start command.
 * @param {Object} options - Recording options (quality, audio, etc.).
 * @returns {Promise<{success: boolean, error?: string}>} Result of the operation.
 */
async function startRecording(options) {
  try {
    const state = await getState();
    if (state.isRecording) {
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

    // Update state with target tab
    await updateState({ recordingTabId: tab.id });

    // Ensure content script is injected and ready
    // First try to ping the content script to see if it's already loaded
    let contentScriptReady = false;
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      contentScriptReady = pingResponse && pingResponse.ready;
    } catch (_err) {
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
        console.warn(`Retry ${6 - retries}/5 - Content script communication failed:`, err.message);
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
    // We update state to indicate we are waiting for 'recordingStarted'
    await updateState({
      isContentScriptRecording: true,
      isRecording: true,
      // Don't set recordingStartTime here - it will be set when recording actually starts
      // after the countdown completes in content.js
      recordingStartTime: 0,
      pausedDuration: 0,
      pauseStartTime: 0
    });

    // Set badge to show recording
    await chrome.action.setBadgeText({ text: 'REC' });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });

    return { success: true };
  } catch (error) {
    console.error('Error starting recording:', error);
    await updateState({
      isRecording: false,
      isContentScriptRecording: false,
      recordingTabId: null
    });
    return { success: false, error: error.message };
  }
}

/**
 * Pauses the current recording.
 * @returns {Promise<{success: boolean, error?: string}>} Result of the operation.
 */
async function pauseRecording() {
  const state = await getState();
  if (!state.recordingTabId) {
    return { success: false, error: 'No active recording tab' };
  }

  try {
    const response = await chrome.tabs.sendMessage(state.recordingTabId, {
      action: 'pauseContentRecording'
    });

    if (response && response.success) {
      await updateState({
        isPaused: true,
        pauseStartTime: Date.now()
      });
      await chrome.action.setBadgeText({ text: '⏸' });
      await chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
      return { success: true };
    } else {
      console.warn('Pause failed:', response?.error);
      return { success: false, error: response?.error || 'Failed to pause' };
    }
  } catch (err) {
    console.error('Error pausing recording:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Resumes the current recording.
 * @returns {Promise<{success: boolean, error?: string}>} Result of the operation.
 */
async function resumeRecording() {
  const state = await getState();
  if (!state.recordingTabId) {
    return { success: false, error: 'No active recording tab' };
  }

  try {
    const response = await chrome.tabs.sendMessage(state.recordingTabId, {
      action: 'resumeContentRecording'
    });

    if (response && response.success) {
      // Add the paused time to the total paused duration
      let newPausedDuration = state.pausedDuration;
      if (state.pauseStartTime > 0) {
        newPausedDuration += Date.now() - state.pauseStartTime;
      }

      await updateState({
        isPaused: false,
        pausedDuration: newPausedDuration,
        pauseStartTime: 0
      });

      await chrome.action.setBadgeText({ text: 'REC' });
      await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      return { success: true };
    } else {
      console.warn('Resume failed:', response?.error);
      return { success: false, error: response?.error || 'Failed to resume' };
    }
  } catch (err) {
    console.error('Error resuming recording:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Stops the current recording.
 * @returns {Promise<{success: boolean, error?: string}>} Result of the operation.
 */
async function stopRecording() {
  const state = await getState();
  const tabId = state.recordingTabId;

  // Reset state first
  await updateState(initialState);
  await chrome.action.setBadgeText({ text: '' });

  if (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'stopContentRecording'
      });
      return { success: true };
    } catch (err) {
      console.error('Error stopping content script recording:', err);
      return { success: true }; // Still return success as recording is stopped and state is reset
    }
  }

  return { success: true };
}

// Keyboard shortcut handlers
chrome.commands.onCommand.addListener(async (command) => {
  const state = await getState();

  if (command === 'toggle-recording') {
    if (state.isRecording) {
      await stopRecording();
    } else {
      // Load saved settings and start recording
      const settings = await chrome.storage.sync.get([
        'captureType', 'audioEnabled', 'micEnabled', 'quality',
        'cameraEnabled', 'cameraPosition', 'cameraSize', 'cameraShape',
        'frameRate', 'format', 'annotationsEnabled'
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
        format: settings.format || 'webm-vp9',
        annotationsEnabled: settings.annotationsEnabled !== false
      };

      await startRecording(options);
    }
  } else if (command === 'pause-resume') {
    if (state.isRecording) {
      if (state.isPaused) {
        await resumeRecording();
      } else {
        await pauseRecording();
      }
    }
  }
});

// Export for testing
if (typeof module !== 'undefined') {
  module.exports = {
    initialState,
    initializeState,
    getState,
    updateState,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording
  };
}
