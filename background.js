// Recording state
let isRecording = false;
let isPaused = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let offscreenDocumentCreated = false;

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
          pauseRecording();
          sendResponse({ success: true });
          break;
          
        case 'resumeRecording':
          resumeRecording();
          sendResponse({ success: true });
          break;
          
        case 'stopRecording':
          await stopRecording();
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

    // Get the stream based on capture type
    let stream;
    
    if (options.captureType === 'tab') {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      // Request tab capture
      stream = await chrome.tabCapture.capture({
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
    } else {
      // For window and screen capture, we need to use getDisplayMedia
      // This requires an offscreen document in Manifest V3
      await ensureOffscreenDocument();
      
      // Send message to offscreen document to get the stream
      const response = await chrome.runtime.sendMessage({
        action: 'getDisplayMedia',
        options: {
          audio: options.audioEnabled,
          video: {
            displaySurface: options.captureType === 'window' ? 'window' : 'monitor'
          }
        }
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to get display media');
      }
      
      stream = response.stream;
    }

    if (!stream) {
      throw new Error('Failed to get media stream');
    }

    // Add microphone if enabled
    if (options.micEnabled) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        
        // Mix system audio and microphone
        if (stream.getAudioTracks().length > 0) {
          const systemAudio = audioContext.createMediaStreamSource(stream);
          systemAudio.connect(destination);
        }
        
        const micAudio = audioContext.createMediaStreamSource(micStream);
        micAudio.connect(destination);
        
        // Replace audio track with mixed audio
        stream.getAudioTracks().forEach(track => track.stop());
        stream.removeTrack(stream.getAudioTracks()[0]);
        destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      } catch (error) {
        console.error('Failed to add microphone:', error);
        // Continue without microphone
      }
    }

    recordingStream = stream;
    recordedChunks = [];
    
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
    };

    mediaRecorder.start(1000); // Capture data every second
    isRecording = true;
    isPaused = false;

    // Update badge
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });

    return { success: true };
  } catch (error) {
    console.error('Error starting recording:', error);
    return { success: false, error: error.message };
  }
}

// Pause recording
function pauseRecording() {
  if (mediaRecorder && isRecording && !isPaused) {
    mediaRecorder.pause();
    isPaused = true;
    chrome.action.setBadgeText({ text: '⏸' });
    chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
  }
}

// Resume recording
function resumeRecording() {
  if (mediaRecorder && isRecording && isPaused) {
    mediaRecorder.resume();
    isPaused = false;
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  }
}

// Stop recording
async function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    
    // Stop all tracks
    if (recordingStream) {
      recordingStream.getTracks().forEach(track => track.stop());
      recordingStream = null;
    }
    
    isRecording = false;
    isPaused = false;
    
    // Clear badge
    chrome.action.setBadgeText({ text: '' });
  }
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

// Ensure offscreen document exists
async function ensureOffscreenDocument() {
  if (offscreenDocumentCreated) {
    return;
  }
  
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (existingContexts.length > 0) {
    offscreenDocumentCreated = true;
    return;
  }
  
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Recording screen with audio'
  });
  
  offscreenDocumentCreated = true;
}

// Clean up on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  if (isRecording) {
    stopRecording();
  }
});
