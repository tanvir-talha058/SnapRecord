// Content script for screen/window capture
// This runs in the context of web pages and has access to navigator.mediaDevices

(function() {
  'use strict';
  
  // Prevent multiple initializations
  if (window.__snapRecordContentScriptLoaded) {
    return; // Already loaded - exit early
  }
  window.__snapRecordContentScriptLoaded = true;

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

// Countdown overlay
function showCountdown(seconds) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'snaprecord-countdown-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const countdownText = document.createElement('div');
    countdownText.style.cssText = `
      font-size: 150px;
      font-weight: bold;
      color: white;
      text-shadow: 0 0 30px rgba(102, 126, 234, 0.8);
      animation: snaprecord-countdown-pulse 1s ease-in-out infinite;
    `;
    
    const style = document.createElement('style');
    style.id = 'snaprecord-countdown-styles';
    style.textContent = `
      @keyframes snaprecord-countdown-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);
    
    overlay.appendChild(countdownText);
    document.body.appendChild(overlay);
    
    let count = seconds;
    countdownText.textContent = count;
    
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownText.textContent = count;
      } else {
        clearInterval(interval);
        overlay.remove();
        style.remove();
        resolve();
      }
    }, 1000);
  });
}

// Annotation/Drawing Tools
let annotationCanvas = null;
let annotationCtx = null;
let annotationToolbar = null;
let isDrawing = false;
let currentTool = 'pen';
let currentColor = '#ff4444';
let brushSize = 4;

function createAnnotationTools() {
  removeAnnotationTools();
  
  // Create canvas overlay
  annotationCanvas = document.createElement('canvas');
  annotationCanvas.id = 'snaprecord-annotation-canvas';
  annotationCanvas.width = window.innerWidth;
  annotationCanvas.height = window.innerHeight;
  annotationCanvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483645;
    pointer-events: none;
    cursor: crosshair;
  `;
  document.body.appendChild(annotationCanvas);
  annotationCtx = annotationCanvas.getContext('2d');
  
  // Create toolbar
  annotationToolbar = document.createElement('div');
  annotationToolbar.id = 'snaprecord-annotation-toolbar';
  annotationToolbar.innerHTML = `
    <button class="tool-btn active" data-tool="pen" title="Pen">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 19l7-7 3 3-7 7-3-3z"/>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
      </svg>
    </button>
    <button class="tool-btn" data-tool="highlighter" title="Highlighter">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 11l-6 6v3h9l3-3"/>
        <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
      </svg>
    </button>
    <button class="tool-btn" data-tool="arrow" title="Arrow">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12 5 19 12 12 19"/>
      </svg>
    </button>
    <button class="tool-btn" data-tool="rectangle" title="Rectangle">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      </svg>
    </button>
    <div class="tool-separator"></div>
    <input type="color" class="color-picker" value="#ff4444" title="Color">
    <div class="tool-separator"></div>
    <button class="tool-btn" data-action="clear" title="Clear All">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    </button>
    <button class="tool-btn toggle-draw" data-action="toggle" title="Toggle Drawing">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
  `;
  annotationToolbar.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: rgba(30, 30, 30, 0.95);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.id = 'snaprecord-annotation-styles';
  style.textContent = `
    #snaprecord-annotation-toolbar .tool-btn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #ccc;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    #snaprecord-annotation-toolbar .tool-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    #snaprecord-annotation-toolbar .tool-btn.active {
      background: rgba(102, 126, 234, 0.3);
      color: #667eea;
    }
    #snaprecord-annotation-toolbar .tool-separator {
      width: 1px;
      height: 24px;
      background: rgba(255, 255, 255, 0.2);
      margin: 0 4px;
    }
    #snaprecord-annotation-toolbar .color-picker {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      padding: 0;
    }
    #snaprecord-annotation-toolbar .toggle-draw.drawing-active {
      background: rgba(34, 197, 94, 0.3);
      color: #22c55e;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(annotationToolbar);
  
  // Set up event listeners
  setupAnnotationEvents();
}

function setupAnnotationEvents() {
  const toolbar = annotationToolbar;
  const canvas = annotationCanvas;
  let startX, startY;
  
  // Tool selection
  toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
    });
  });
  
  // Color picker
  toolbar.querySelector('.color-picker').addEventListener('input', (e) => {
    currentColor = e.target.value;
  });
  
  // Clear
  toolbar.querySelector('[data-action="clear"]').addEventListener('click', () => {
    annotationCtx.clearRect(0, 0, canvas.width, canvas.height);
  });
  
  // Toggle drawing
  const toggleBtn = toolbar.querySelector('[data-action="toggle"]');
  toggleBtn.addEventListener('click', () => {
    const isActive = canvas.style.pointerEvents === 'auto';
    canvas.style.pointerEvents = isActive ? 'none' : 'auto';
    toggleBtn.classList.toggle('drawing-active', !isActive);
  });
  
  // Drawing events
  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    
    if (currentTool === 'pen' || currentTool === 'highlighter') {
      annotationCtx.beginPath();
      annotationCtx.moveTo(startX, startY);
    }
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    
    if (currentTool === 'pen') {
      annotationCtx.strokeStyle = currentColor;
      annotationCtx.lineWidth = brushSize;
      annotationCtx.lineCap = 'round';
      annotationCtx.lineTo(e.clientX, e.clientY);
      annotationCtx.stroke();
    } else if (currentTool === 'highlighter') {
      annotationCtx.strokeStyle = currentColor + '40';
      annotationCtx.lineWidth = 20;
      annotationCtx.lineCap = 'round';
      annotationCtx.lineTo(e.clientX, e.clientY);
      annotationCtx.stroke();
    }
  });
  
  canvas.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    
    const endX = e.clientX;
    const endY = e.clientY;
    
    if (currentTool === 'arrow') {
      drawArrow(startX, startY, endX, endY);
    } else if (currentTool === 'rectangle') {
      annotationCtx.strokeStyle = currentColor;
      annotationCtx.lineWidth = brushSize;
      annotationCtx.strokeRect(startX, startY, endX - startX, endY - startY);
    }
  });
  
  canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
  });
}

function drawArrow(fromX, fromY, toX, toY) {
  const headLength = 15;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  
  annotationCtx.strokeStyle = currentColor;
  annotationCtx.lineWidth = brushSize;
  annotationCtx.lineCap = 'round';
  
  // Line
  annotationCtx.beginPath();
  annotationCtx.moveTo(fromX, fromY);
  annotationCtx.lineTo(toX, toY);
  annotationCtx.stroke();
  
  // Arrow head
  annotationCtx.beginPath();
  annotationCtx.moveTo(toX, toY);
  annotationCtx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
  annotationCtx.moveTo(toX, toY);
  annotationCtx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
  annotationCtx.stroke();
}

function removeAnnotationTools() {
  if (annotationCanvas) {
    annotationCanvas.remove();
    annotationCanvas = null;
  }
  if (annotationToolbar) {
    annotationToolbar.remove();
    annotationToolbar = null;
  }
  const style = document.getElementById('snaprecord-annotation-styles');
  if (style) style.remove();
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

// Single consolidated message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ping to check if content script is ready
  if (request.action === 'ping') {
    sendResponse({ success: true, ready: true });
    return true;
  }
  
  if (request.action === 'showCountdown') {
    showCountdown(request.seconds || 3)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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
    removeAnnotationTools();
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
      try {
        await startCamera(options);
      } catch (camError) {
        console.warn('Camera access denied, continuing without camera:', camError);
      }
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
    try {
      currentStream = await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (displayError) {
      // User cancelled or error - clean up camera overlay
      removeCameraOverlay();
      throw displayError;
    }

    if (!currentStream) {
      removeCameraOverlay();
      throw new Error('Failed to get display media stream');
    }

    // Add microphone audio if enabled
    if (options.micEnabled) {
      try {
        const audioConstraints = {
          audio: options.micDeviceId && options.micDeviceId !== 'default'
            ? { deviceId: { exact: options.micDeviceId } }
            : true,
          video: false
        };
        const micStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        const micTrack = micStream.getAudioTracks()[0];
        if (micTrack) {
          currentStream.addTrack(micTrack);
        }
      } catch (micError) {
        console.warn('Microphone access denied, continuing without mic:', micError);
      }
    }

    // Handle stream ending (user clicks "Stop sharing")
    currentStream.getVideoTracks()[0].addEventListener('ended', () => {
      const recorder = window.__snapRecordMediaRecorder;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      removeCameraOverlay();
      chrome.runtime.sendMessage({ action: 'stopRecording' }).catch(() => {});
    });

    // Since we can't easily transfer MediaStream between contexts in Manifest V3,
    // we'll create a MediaRecorder here in the content script and send chunks to background
    startRecordingInContent(currentStream, options);

    return { success: true, message: 'Recording started in content script' };
  } catch (error) {
    console.error('Error capturing display:', error);
    removeCameraOverlay();
    return { success: false, error: error.message };
  }
}

function startRecordingInContent(stream, options) {
  // Create annotation tools if enabled
  if (options.annotationsEnabled !== false) {
    createAnnotationTools();
  }
  
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
    
    // Clean up camera overlay and annotation tools
    removeCameraOverlay();
    removeAnnotationTools();
    
    // Save to recording history
    saveToHistory(filename, options);
  };
  
  // Track recording start time for duration calculation
  const recordingStartTime = Date.now();
  
  // Save recording to history
  function saveToHistory(filename, options) {
    const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
    const historyEntry = {
      filename,
      date: new Date().toISOString(),
      duration,
      quality: options.quality || '1080',
      format: options.format || 'webm-vp9'
    };
    
    chrome.storage.local.get('recordingHistory', (result) => {
      const history = result.recordingHistory || [];
      history.push(historyEntry);
      // Keep only last 100 recordings
      if (history.length > 100) history.shift();
      chrome.storage.local.set({ recordingHistory: history });
    });
  }

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

})(); // End of IIFE
