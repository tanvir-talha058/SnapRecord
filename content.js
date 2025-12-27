// Content script for screen/window capture
// This runs in the context of web pages and has access to navigator.mediaDevices

// Prevent multiple injections
if (window.__snapRecordContentScriptLoaded) {
  console.log('SnapRecord content script already loaded');
} else {
  window.__snapRecordContentScriptLoaded = true;
}

let currentStream = null;
let cameraStream = null;
let cameraOverlay = null;

// Utility function for generating filenames
function generateRecordingFilename(extension = 'webm') {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `SnapRecord_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.${extension}`;
}

// Camera overlay management
function createCameraOverlay(options) {
  // Remove existing overlay if present
  removeCameraOverlay();
  
  const overlay = document.createElement('div');
  overlay.id = 'snaprecord-camera-overlay';
  
  // Size settings
  const sizes = {
    small: { width: 120, height: 120 },
    medium: { width: 180, height: 180 },
    large: { width: 250, height: 250 }
  };
  
  const size = sizes[options.cameraSize] || sizes.medium;
  
  // Position settings
  const positions = {
    'bottom-right': { bottom: '20px', right: '20px', top: 'auto', left: 'auto' },
    'bottom-left': { bottom: '20px', left: '20px', top: 'auto', right: 'auto' },
    'top-right': { top: '20px', right: '20px', bottom: 'auto', left: 'auto' },
    'top-left': { top: '20px', left: '20px', bottom: 'auto', right: 'auto' }
  };
  
  const position = positions[options.cameraPosition] || positions['bottom-right'];
  
  // Shape settings
  let borderRadius;
  switch (options.cameraShape) {
    case 'circle':
      borderRadius = '50%';
      break;
    case 'square':
      borderRadius = '0';
      break;
    case 'rounded':
      borderRadius = '12px';
      break;
    default:
      borderRadius = '50%';
  }
  
  overlay.style.cssText = `
    position: fixed;
    width: ${size.width}px;
    height: ${size.height}px;
    ${Object.entries(position).map(([k, v]) => `${k}: ${v}`).join('; ')};
    z-index: 2147483647;
    border: 3px solid #667eea;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border-radius: ${borderRadius};
    overflow: hidden;
    cursor: move;
    transition: box-shadow 0.2s ease;
    background: #000;
  `;
  
  const video = document.createElement('video');
  video.id = 'snaprecord-camera-video';
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
  `;
  
  overlay.appendChild(video);
  
  // Add resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.style.cssText = `
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, #667eea 50%);
    border-radius: 0 0 ${options.cameraShape === 'circle' ? '50%' : borderRadius} 0;
  `;
  overlay.appendChild(resizeHandle);
  
  // Make draggable
  makeDraggable(overlay);
  
  // Make resizable
  makeResizable(overlay, resizeHandle, options.cameraShape);
  
  document.body.appendChild(overlay);
  cameraOverlay = overlay;
  
  return video;
}

function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, initialX, initialY;
  
  element.addEventListener('mousedown', (e) => {
    if (e.target.style.cursor === 'nwse-resize') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = element.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    element.style.transition = 'none';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    let newX = initialX + dx;
    let newY = initialY + dy;
    
    // Keep within viewport
    newX = Math.max(0, Math.min(newX, window.innerWidth - element.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - element.offsetHeight));
    
    element.style.left = newX + 'px';
    element.style.top = newY + 'px';
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    element.style.transition = 'box-shadow 0.2s ease';
  });
}

function makeResizable(element, handle, shape) {
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  
  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = element.offsetWidth;
    startHeight = element.offsetHeight;
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    // Maintain aspect ratio for circle
    const delta = Math.max(dx, dy);
    
    let newWidth = startWidth + delta;
    let newHeight = startHeight + delta;
    
    // Minimum and maximum size
    newWidth = Math.max(80, Math.min(400, newWidth));
    newHeight = Math.max(80, Math.min(400, newHeight));
    
    element.style.width = newWidth + 'px';
    element.style.height = newHeight + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    isResizing = false;
  });
}

function removeCameraOverlay() {
  if (cameraOverlay) {
    cameraOverlay.remove();
    cameraOverlay = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}

async function startCamera(options) {
  try {
    const videoElement = createCameraOverlay(options);
    
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false // Audio is handled separately via mic option
    });
    
    videoElement.srcObject = cameraStream;
    return cameraStream;
  } catch (error) {
    console.error('Error accessing camera:', error);
    removeCameraOverlay();
    throw error;
  }
}

// Flag to prevent multiple injections
if (window.__snapRecordContentScriptLoaded) {
  console.log('SnapRecord content script already loaded');
} else {
  window.__snapRecordContentScriptLoaded = true;
  console.log('SnapRecord content script loaded');
}

// Single consolidated message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ping to check if content script is ready
  if (request.action === 'ping') {
    sendResponse({ success: true, ready: true });
    return true;
  }
  
  if (request.action === 'startCapture') {
    handleStartCapture(request.captureType, request.options)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'showCameraOverlay') {
    startCamera(request.options)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'hideCameraOverlay') {
    removeCameraOverlay();
    sendResponse({ success: true });
    return true;
  }
  
  // Recording control actions
  const recorder = window.__snapRecordMediaRecorder;
  
  if (request.action === 'pauseContentRecording') {
    if (!recorder) {
      sendResponse({ success: false, error: 'No active recorder' });
      return true;
    }
    if (recorder.state === 'recording') {
      recorder.pause();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Not recording' });
    }
    return true;
  }
  
  if (request.action === 'resumeContentRecording') {
    if (!recorder) {
      sendResponse({ success: false, error: 'No active recorder' });
      return true;
    }
    if (recorder.state === 'paused') {
      recorder.resume();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Not paused' });
    }
    return true;
  }
  
  if (request.action === 'stopContentRecording') {
    if (!recorder) {
      // Already stopped, clean up camera overlay anyway
      removeCameraOverlay();
      sendResponse({ success: true });
      return true;
    }
    if (recorder.state !== 'inactive') {
      recorder.stop();
      window.__snapRecordMediaRecorder = null;
      removeCameraOverlay();
      sendResponse({ success: true });
    } else {
      window.__snapRecordMediaRecorder = null;
      removeCameraOverlay();
      sendResponse({ success: true });
    }
    return true;
  }
  
  // Unknown action
  return false;
});

async function handleStartCapture(captureType, options) {
  try {
    // Clean up any existing stream
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      currentStream = null;
    }

    // Start camera overlay if enabled
    if (options.cameraEnabled) {
      await startCamera(options);
    }

    // Resolution settings based on quality
    const resolutions = {
      '480': { width: 854, height: 480 },
      '720': { width: 1280, height: 720 },
      '1080': { width: 1920, height: 1080 },
      '1440': { width: 2560, height: 1440 },
      '2160': { width: 3840, height: 2160 }
    };
    
    const resolution = resolutions[options.quality] || resolutions['1080'];
    const frameRate = parseInt(options.frameRate) || 30;

    // Request display media
    const constraints = {
      video: {
        displaySurface: captureType === 'screen' ? 'monitor' : captureType === 'window' ? 'window' : 'browser',
        width: { ideal: resolution.width },
        height: { ideal: resolution.height },
        frameRate: { ideal: frameRate, max: frameRate }
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
  // Determine MIME type based on format selection
  let mimeType;
  let fileExtension = 'webm';
  
  switch (options.format) {
    case 'webm-vp9':
      mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
        ? 'video/webm; codecs=vp9' 
        : 'video/webm';
      break;
    case 'webm-vp8':
      mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp8') 
        ? 'video/webm; codecs=vp8' 
        : 'video/webm';
      break;
    case 'webm-h264':
      mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=h264') 
        ? 'video/webm; codecs=h264' 
        : 'video/webm';
      break;
    case 'mp4':
      // Browser support for MP4 recording is limited, fallback to WebM
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        fileExtension = 'mp4';
      } else {
        mimeType = 'video/webm; codecs=h264';
      }
      break;
    case 'gif':
      // GIF is not directly supported, record as WebM for now
      mimeType = 'video/webm';
      break;
    default:
      mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
        ? 'video/webm; codecs=vp9' 
        : 'video/webm';
  }
  
  // Calculate bitrate based on quality and frame rate
  const qualityBitrates = {
    '480': 1500000,
    '720': 2500000,
    '1080': 5000000,
    '1440': 8000000,
    '2160': 16000000
  };
  
  const frameRateMultipliers = {
    '24': 0.8,
    '30': 1,
    '60': 1.5
  };
  
  const baseBitrate = qualityBitrates[options.quality] || 5000000;
  const fpsMultiplier = frameRateMultipliers[options.frameRate] || 1;
  const videoBitsPerSecond = Math.round(baseBitrate * fpsMultiplier);
  
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond
  });

  const recordedChunks = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: mimeType });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const filename = generateRecordingFilename(fileExtension);
    
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
