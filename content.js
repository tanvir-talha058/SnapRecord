// Content script for screen/window capture
// This runs in the context of web pages and has access to navigator.mediaDevices

let currentStream = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    handleStartCapture(request.captureType, request.options)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

async function handleStartCapture(captureType, options) {
  try {
    // Clean up any existing stream
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      currentStream = null;
    }

    // Request display media
    const constraints = {
      video: {
        displaySurface: captureType === 'screen' ? 'monitor' : captureType === 'window' ? 'window' : 'browser',
        width: { ideal: options.quality === '1440' ? 2560 : options.quality === '1080' ? 1920 : 1280 },
        height: { ideal: options.quality === '1440' ? 1440 : options.quality === '1080' ? 1080 : 720 }
      },
      audio: options.audioEnabled
    };

    // Get display media stream
    currentStream = await navigator.mediaDevices.getDisplayMedia(constraints);

    if (!currentStream) {
      throw new Error('Failed to get display media stream');
    }

    // Since we can't easily transfer MediaStream between contexts in Manifest V3,
    // we'll create a MediaRecorder here in the content script and send chunks to background
    startRecordingInContent(currentStream, options);

    return { success: true, message: 'Recording started in content script' };
  } catch (error) {
    console.error('Error capturing display:', error);
    return { success: false, error: error.message };
  }
}

function startRecordingInContent(stream, options) {
  const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
    ? 'video/webm; codecs=vp9'
    : 'video/webm';
  
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: options.quality === '1440' ? 8000000 : 
                       options.quality === '1080' ? 5000000 : 2500000
  });

  const recordedChunks = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
      // Could send chunks to background, but keeping it simple for now
    }
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const date = new Date();
    const filename = `SnapRecord_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}.webm`;
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    // Stop all tracks
    stream.getTracks().forEach(track => track.stop());
  };

  // Store recorder reference for pause/resume/stop
  window.__snapRecordMediaRecorder = mediaRecorder;
  
  // Start recording
  mediaRecorder.start(1000);
  
  // Notify background that recording started
  chrome.runtime.sendMessage({
    action: 'recordingStarted',
    inContentScript: true
  });
}

// Listen for stop/pause/resume commands
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const recorder = window.__snapRecordMediaRecorder;
  
  if (!recorder) {
    sendResponse({ success: false, error: 'No active recorder' });
    return;
  }
  
  switch (request.action) {
    case 'pauseContentRecording':
      if (recorder.state === 'recording') {
        recorder.pause();
        sendResponse({ success: true });
      }
      break;
      
    case 'resumeContentRecording':
      if (recorder.state === 'paused') {
        recorder.resume();
        sendResponse({ success: true });
      }
      break;
      
    case 'stopContentRecording':
      if (recorder.state !== 'inactive') {
        recorder.stop();
        window.__snapRecordMediaRecorder = null;
        sendResponse({ success: true });
      }
      break;
  }
  
  return true;
});
