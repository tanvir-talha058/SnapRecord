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
let drawingHistory = [];
let historyIndex = -1;
let tempCanvas = null;
let tempCtx = null;
let isToolbarVisible = true;
let isToolbarMinimized = false;
let isDrawingEnabled = false;

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
    touch-action: none;
  `;
  document.body.appendChild(annotationCanvas);
  annotationCtx = annotationCanvas.getContext('2d');
  annotationCtx.lineCap = 'round';
  annotationCtx.lineJoin = 'round';
  
  // Create temporary canvas for shape preview
  tempCanvas = document.createElement('canvas');
  tempCanvas.id = 'snaprecord-temp-canvas';
  tempCanvas.width = window.innerWidth;
  tempCanvas.height = window.innerHeight;
  tempCanvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483644;
    pointer-events: none;
  `;
  document.body.appendChild(tempCanvas);
  tempCtx = tempCanvas.getContext('2d');
  tempCtx.lineCap = 'round';
  tempCtx.lineJoin = 'round';
  
  // Handle window resize
  window.addEventListener('resize', handleCanvasResize);
  
  // Create toolbar
  annotationToolbar = document.createElement('div');
  annotationToolbar.id = 'snaprecord-annotation-toolbar';
  annotationToolbar.innerHTML = `
    <div class="toolbar-main">
      <div class="toolbar-toggle" data-action="minimize" title="Minimize Toolbar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 14 10 14 10 20"/>
          <polyline points="20 10 14 10 14 4"/>
          <line x1="14" y1="10" x2="21" y2="3"/>
          <line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </div>
      <div class="tool-separator"></div>
      <button class="tool-btn" data-tool="cursor" title="Cursor (Disable Drawing)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
          <path d="M13 13l6 6"/>
        </svg>
      </button>
      <button class="tool-btn active" data-tool="pen" title="Pen (P)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="highlighter" title="Highlighter (H)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l-6 6v3h9l3-3"/>
          <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="arrow" title="Arrow (A)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="line" title="Line (L)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="4" y1="20" x2="20" y2="4"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="rectangle" title="Rectangle (R)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="circle" title="Circle (C)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="text" title="Text (T)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 7 4 4 20 4 20 7"/>
          <line x1="9" y1="20" x2="15" y2="20"/>
          <line x1="12" y1="4" x2="12" y2="20"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="eraser" title="Eraser (E)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 20H7L3 16c-.6-.6-.6-1.5 0-2.1l10-10c.6-.6 1.5-.6 2.1 0l7 7c.6.6.6 1.5 0 2.1L15 20"/>
          <path d="M6 11l7 7"/>
        </svg>
      </button>
      <div class="tool-separator"></div>
      <div class="color-container">
        <div class="color-presets">
          <button class="color-preset active" data-color="#ff4444" style="background:#ff4444" title="Red"></button>
          <button class="color-preset" data-color="#ffd000" style="background:#ffd000" title="Yellow"></button>
          <button class="color-preset" data-color="#00d26a" style="background:#00d26a" title="Green"></button>
          <button class="color-preset" data-color="#0088ff" style="background:#0088ff" title="Blue"></button>
          <button class="color-preset" data-color="#ffffff" style="background:#ffffff" title="White"></button>
          <button class="color-preset" data-color="#000000" style="background:#000000" title="Black"></button>
        </div>
        <input type="color" class="color-picker" value="#ff4444" title="Custom Color">
      </div>
      <div class="tool-separator"></div>
      <div class="brush-size-container">
        <label class="brush-label">Size</label>
        <input type="range" class="brush-slider" min="1" max="20" value="4" title="Brush Size">
        <span class="brush-value">4</span>
      </div>
      <div class="tool-separator"></div>
      <button class="tool-btn" data-action="undo" title="Undo (Ctrl+Z)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v6h6"/>
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
        </svg>
      </button>
      <button class="tool-btn" data-action="redo" title="Redo (Ctrl+Y)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 7v6h-6"/>
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
        </svg>
      </button>
      <button class="tool-btn" data-action="clear" title="Clear All">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
      <div class="tool-separator"></div>
      <button class="tool-btn toggle-draw drawing-active" data-action="toggle" title="Toggle Drawing Mode (D)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
          <line x1="2" y1="2" x2="22" y2="22" class="toggle-off-line" style="display:none;stroke:#ff4444;stroke-width:3"/>
        </svg>
      </button>
      <button class="tool-btn" data-action="hide" title="Hide Toolbar (Esc)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      </button>
    </div>
    <div class="toolbar-minimized" style="display:none;">
      <button class="tool-btn" data-action="expand" title="Expand Toolbar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        </svg>
      </button>
    </div>
  `;
  annotationToolbar.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.id = 'snaprecord-annotation-styles';
  style.textContent = `
    #snaprecord-annotation-toolbar .toolbar-main {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
      background: rgba(20, 20, 25, 0.96);
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      cursor: grab;
    }
    #snaprecord-annotation-toolbar .toolbar-main:active {
      cursor: grabbing;
    }
    #snaprecord-annotation-toolbar .toolbar-main .tool-btn,
    #snaprecord-annotation-toolbar .toolbar-main .color-picker,
    #snaprecord-annotation-toolbar .toolbar-main .color-preset,
    #snaprecord-annotation-toolbar .toolbar-main .brush-slider,
    #snaprecord-annotation-toolbar .toolbar-main input {
      cursor: pointer;
    }
    #snaprecord-annotation-toolbar .toolbar-minimized {
      padding: 8px;
      background: rgba(20, 20, 25, 0.96);
      border-radius: 50%;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      cursor: pointer;
    }
    #snaprecord-annotation-toolbar .toolbar-minimized:hover {
      background: rgba(40, 40, 50, 0.96);
    }
    #snaprecord-annotation-toolbar .toolbar-toggle {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      color: #888;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    #snaprecord-annotation-toolbar .toolbar-toggle:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    #snaprecord-annotation-toolbar .tool-btn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #aaa;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
    }
    #snaprecord-annotation-toolbar .tool-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      transform: translateY(-1px);
    }
    #snaprecord-annotation-toolbar .tool-btn:active {
      transform: translateY(0);
    }
    #snaprecord-annotation-toolbar .tool-btn.active {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.4) 0%, rgba(118, 75, 162, 0.4) 100%);
      color: #a5b4fc;
      box-shadow: 0 0 12px rgba(102, 126, 234, 0.3);
    }
    #snaprecord-annotation-toolbar .tool-btn.drawing-active {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.4) 0%, rgba(16, 185, 129, 0.4) 100%);
      color: #86efac;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.3);
    }
    #snaprecord-annotation-toolbar .tool-btn.drawing-inactive {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
    }
    #snaprecord-annotation-toolbar .tool-separator {
      width: 1px;
      height: 28px;
      background: rgba(255, 255, 255, 0.15);
      margin: 0 6px;
    }
    #snaprecord-annotation-toolbar .color-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #snaprecord-annotation-toolbar .color-presets {
      display: flex;
      gap: 4px;
    }
    #snaprecord-annotation-toolbar .color-preset {
      width: 22px;
      height: 22px;
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;
    }
    #snaprecord-annotation-toolbar .color-preset:hover {
      transform: scale(1.15);
      border-color: rgba(255,255,255,0.5);
    }
    #snaprecord-annotation-toolbar .color-preset.active {
      border-color: #fff;
      box-shadow: 0 0 8px rgba(255,255,255,0.4);
    }
    #snaprecord-annotation-toolbar .color-picker {
      width: 28px;
      height: 28px;
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      cursor: pointer;
      padding: 0;
      background: none;
    }
    #snaprecord-annotation-toolbar .color-picker::-webkit-color-swatch-wrapper {
      padding: 2px;
    }
    #snaprecord-annotation-toolbar .color-picker::-webkit-color-swatch {
      border-radius: 50%;
      border: none;
    }
    #snaprecord-annotation-toolbar .brush-size-container {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #snaprecord-annotation-toolbar .brush-label {
      color: #888;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    #snaprecord-annotation-toolbar .brush-slider {
      width: 60px;
      height: 4px;
      -webkit-appearance: none;
      background: rgba(255,255,255,0.2);
      border-radius: 2px;
      cursor: pointer;
    }
    #snaprecord-annotation-toolbar .brush-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      background: #667eea;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    #snaprecord-annotation-toolbar .brush-value {
      color: #aaa;
      font-size: 11px;
      min-width: 18px;
      text-align: center;
    }
    #snaprecord-annotation-toolbar .toggle-draw.drawing-active .toggle-off-line {
      display: none !important;
    }
    #snaprecord-annotation-toolbar .toggle-draw.drawing-inactive .toggle-off-line {
      display: block !important;
    }
    #snaprecord-annotation-canvas.drawing-enabled {
      cursor: crosshair !important;
    }
    #snaprecord-annotation-canvas.eraser-mode {
      cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="8" fill="rgba(255,255,255,0.3)"/></svg>') 12 12, crosshair !important;
    }
    #snaprecord-drawing-indicator {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: rgba(34, 197, 94, 0.9);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 600;
      border-radius: 20px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    #snaprecord-drawing-indicator.visible {
      opacity: 1;
    }
    #snaprecord-drawing-indicator .indicator-dot {
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
      animation: snaprecord-indicator-pulse 1.5s ease-in-out infinite;
    }
    @keyframes snaprecord-indicator-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes snaprecord-fadeIn {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    #snaprecord-annotation-toolbar {
      animation: snaprecord-fadeIn 0.3s ease;
    }
    #snaprecord-text-input {
      position: fixed;
      z-index: 2147483648;
      background: rgba(20, 20, 25, 0.95);
      border: 2px solid #667eea;
      border-radius: 8px;
      padding: 8px 12px;
      color: white;
      font-size: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      outline: none;
      min-width: 200px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    #snaprecord-show-toolbar-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      cursor: pointer;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      transition: all 0.2s ease;
    }
    #snaprecord-show-toolbar-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(annotationToolbar);
  
  // Make toolbar draggable
  makeToolbarDraggable();
  
  // Initialize drawing as enabled
  isDrawingEnabled = true;
  annotationCanvas.style.pointerEvents = 'auto';
  
  // Save initial state to history
  saveToHistory();
  
  // Set up event listeners
  setupAnnotationEvents();
}

function makeToolbarDraggable() {
  if (!annotationToolbar) return;
  
  const toolbar = annotationToolbar;
  const mainToolbar = toolbar.querySelector('.toolbar-main');
  let isDragging = false;
  let startX, startY;
  let toolbarX, toolbarY;
  
  mainToolbar.addEventListener('mousedown', (e) => {
    // Don't drag if clicking on a button or input
    if (e.target.closest('.tool-btn') || 
        e.target.closest('.color-picker') || 
        e.target.closest('.color-preset') ||
        e.target.closest('.brush-slider') ||
        e.target.closest('input')) {
      return;
    }
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = toolbar.getBoundingClientRect();
    toolbarX = rect.left + rect.width / 2;
    toolbarY = rect.top;
    
    // Switch from transform-based centering to fixed positioning
    toolbar.style.left = rect.left + 'px';
    toolbar.style.top = rect.top + 'px';
    toolbar.style.transform = 'none';
    toolbar.style.bottom = 'auto';
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    let newX = toolbarX + dx - toolbar.offsetWidth / 2;
    let newY = toolbarY + dy;
    
    // Keep within viewport
    newX = Math.max(0, Math.min(newX, window.innerWidth - toolbar.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - toolbar.offsetHeight));
    
    toolbar.style.left = newX + 'px';
    toolbar.style.top = newY + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

function handleCanvasResize() {
  if (!annotationCanvas || !tempCanvas) return;
  
  // Save current drawing
  const imageData = annotationCtx.getImageData(0, 0, annotationCanvas.width, annotationCanvas.height);
  
  // Resize canvases
  annotationCanvas.width = window.innerWidth;
  annotationCanvas.height = window.innerHeight;
  tempCanvas.width = window.innerWidth;
  tempCanvas.height = window.innerHeight;
  
  // Restore drawing
  annotationCtx.putImageData(imageData, 0, 0);
  
  // Reset context properties
  annotationCtx.lineCap = 'round';
  annotationCtx.lineJoin = 'round';
  tempCtx.lineCap = 'round';
  tempCtx.lineJoin = 'round';
}

function saveToHistory() {
  if (!annotationCanvas) return;
  
  // Remove any redo history
  drawingHistory = drawingHistory.slice(0, historyIndex + 1);
  
  // Save current state
  const imageData = annotationCtx.getImageData(0, 0, annotationCanvas.width, annotationCanvas.height);
  drawingHistory.push(imageData);
  historyIndex++;
  
  // Limit history size
  if (drawingHistory.length > 50) {
    drawingHistory.shift();
    historyIndex--;
  }
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    annotationCtx.putImageData(drawingHistory[historyIndex], 0, 0);
  }
}

function redo() {
  if (historyIndex < drawingHistory.length - 1) {
    historyIndex++;
    annotationCtx.putImageData(drawingHistory[historyIndex], 0, 0);
  }
}

function showToolbar() {
  if (annotationToolbar) {
    annotationToolbar.style.display = 'flex';
    isToolbarVisible = true;
  }
  const showBtn = document.getElementById('snaprecord-show-toolbar-btn');
  if (showBtn) showBtn.remove();
}

function hideToolbar() {
  if (annotationToolbar) {
    annotationToolbar.style.display = 'none';
    isToolbarVisible = false;
  }
  
  // Create show button
  let showBtn = document.getElementById('snaprecord-show-toolbar-btn');
  if (!showBtn) {
    showBtn = document.createElement('button');
    showBtn.id = 'snaprecord-show-toolbar-btn';
    showBtn.title = 'Show Drawing Tools';
    showBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 19l7-7 3 3-7 7-3-3z"/>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
      </svg>
    `;
    showBtn.onclick = showToolbar;
    document.body.appendChild(showBtn);
  }
}

function minimizeToolbar() {
  const main = annotationToolbar.querySelector('.toolbar-main');
  const minimized = annotationToolbar.querySelector('.toolbar-minimized');
  if (main && minimized) {
    main.style.display = 'none';
    minimized.style.display = 'flex';
    isToolbarMinimized = true;
  }
}

function expandToolbar() {
  const main = annotationToolbar.querySelector('.toolbar-main');
  const minimized = annotationToolbar.querySelector('.toolbar-minimized');
  if (main && minimized) {
    main.style.display = 'flex';
    minimized.style.display = 'none';
    isToolbarMinimized = false;
  }
}

function toggleDrawingMode(enable) {
  if (typeof enable === 'boolean') {
    isDrawingEnabled = enable;
  } else {
    isDrawingEnabled = !isDrawingEnabled;
  }
  
  annotationCanvas.style.pointerEvents = isDrawingEnabled ? 'auto' : 'none';
  
  const toggleBtn = annotationToolbar.querySelector('[data-action="toggle"]');
  if (toggleBtn) {
    toggleBtn.classList.toggle('drawing-active', isDrawingEnabled);
    toggleBtn.classList.toggle('drawing-inactive', !isDrawingEnabled);
  }
  
  if (isDrawingEnabled) {
    annotationCanvas.classList.add('drawing-enabled');
    if (currentTool === 'eraser') {
      annotationCanvas.classList.add('eraser-mode');
    }
  } else {
    annotationCanvas.classList.remove('drawing-enabled', 'eraser-mode');
  }
}

// Store keyboard handler reference for proper cleanup
let keyboardHandler = null;

function setupAnnotationEvents() {
  const toolbar = annotationToolbar;
  const canvas = annotationCanvas;
  let startX, startY;
  let lastX, lastY;
  let textInput = null;
  
  // Keyboard shortcuts handler
  keyboardHandler = function(e) {
    if (!annotationToolbar) return;
    
    // Ignore if typing in text input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // Escape to hide toolbar
    if (e.key === 'Escape') {
      if (textInput) {
        textInput.remove();
        textInput = null;
      } else if (isToolbarVisible) {
        hideToolbar();
      }
      return;
    }
    
    // Tool shortcuts (only when not typing)
    const shortcuts = {
      'p': 'pen',
      'h': 'highlighter',
      'a': 'arrow',
      'l': 'line',
      'r': 'rectangle',
      'c': 'circle',
      't': 'text',
      'e': 'eraser'
    };
    
    if (shortcuts[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
      selectTool(shortcuts[e.key.toLowerCase()]);
      return;
    }
    
    // D to toggle drawing
    if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey) {
      toggleDrawingMode();
      return;
    }
    
    // Ctrl+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    
    // Ctrl+Y or Ctrl+Shift+Z for redo
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }
  };
  
  document.addEventListener('keydown', keyboardHandler);
  
  function selectTool(tool) {
    currentTool = tool;
    toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    const btn = toolbar.querySelector(`[data-tool="${tool}"]`);
    if (btn) btn.classList.add('active');
    
    // Update cursor
    annotationCanvas.classList.remove('eraser-mode');
    if (tool === 'eraser') {
      annotationCanvas.classList.add('eraser-mode');
    }
    
    // Enable drawing when selecting a drawing tool (not cursor)
    if (tool !== 'cursor' && !isDrawingEnabled) {
      toggleDrawingMode(true);
    }
    
    // Disable drawing when selecting cursor
    if (tool === 'cursor') {
      toggleDrawingMode(false);
    }
  }
  
  // Tool selection
  toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectTool(btn.dataset.tool);
    });
  });
  
  // Color presets
  toolbar.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentColor = btn.dataset.color;
      toolbar.querySelector('.color-picker').value = currentColor;
    });
  });
  
  // Color picker
  toolbar.querySelector('.color-picker').addEventListener('input', (e) => {
    currentColor = e.target.value;
    toolbar.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
  });
  
  // Brush size
  const brushSlider = toolbar.querySelector('.brush-slider');
  const brushValue = toolbar.querySelector('.brush-value');
  brushSlider.addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
    brushValue.textContent = brushSize;
  });
  
  // Action buttons
  toolbar.querySelector('[data-action="clear"]').addEventListener('click', () => {
    annotationCtx.clearRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  });
  
  toolbar.querySelector('[data-action="undo"]').addEventListener('click', undo);
  toolbar.querySelector('[data-action="redo"]').addEventListener('click', redo);
  
  toolbar.querySelector('[data-action="toggle"]').addEventListener('click', () => {
    toggleDrawingMode();
  });
  
  toolbar.querySelector('[data-action="hide"]').addEventListener('click', hideToolbar);
  
  toolbar.querySelector('[data-action="minimize"]').addEventListener('click', minimizeToolbar);
  toolbar.querySelector('[data-action="expand"]').addEventListener('click', expandToolbar);
  
  // Drawing events - Mouse
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseLeave);
  
  // Drawing events - Touch
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd);
  
  function handleMouseDown(e) {
    if (currentTool === 'cursor') return;
    
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    lastX = startX;
    lastY = startY;
    
    if (currentTool === 'text') {
      isDrawing = false;
      showTextInput(startX, startY);
      return;
    }
    
    if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
      annotationCtx.beginPath();
      annotationCtx.moveTo(startX, startY);
    }
  }
  
  function handleMouseMove(e) {
    if (!isDrawing) return;
    
    const x = e.clientX;
    const y = e.clientY;
    
    if (currentTool === 'pen') {
      annotationCtx.strokeStyle = currentColor;
      annotationCtx.lineWidth = brushSize;
      annotationCtx.lineTo(x, y);
      annotationCtx.stroke();
      annotationCtx.beginPath();
      annotationCtx.moveTo(x, y);
    } else if (currentTool === 'highlighter') {
      annotationCtx.strokeStyle = currentColor + '50';
      annotationCtx.lineWidth = brushSize * 5;
      annotationCtx.lineTo(x, y);
      annotationCtx.stroke();
      annotationCtx.beginPath();
      annotationCtx.moveTo(x, y);
    } else if (currentTool === 'eraser') {
      annotationCtx.save();
      annotationCtx.globalCompositeOperation = 'destination-out';
      annotationCtx.lineWidth = brushSize * 3;
      annotationCtx.lineTo(x, y);
      annotationCtx.stroke();
      annotationCtx.beginPath();
      annotationCtx.moveTo(x, y);
      annotationCtx.restore();
    } else if (currentTool === 'arrow' || currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
      // Preview on temp canvas
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.strokeStyle = currentColor;
      tempCtx.lineWidth = brushSize;
      
      if (currentTool === 'arrow') {
        drawArrowOnCtx(tempCtx, startX, startY, x, y);
      } else if (currentTool === 'line') {
        tempCtx.beginPath();
        tempCtx.moveTo(startX, startY);
        tempCtx.lineTo(x, y);
        tempCtx.stroke();
      } else if (currentTool === 'rectangle') {
        tempCtx.strokeRect(startX, startY, x - startX, y - startY);
      } else if (currentTool === 'circle') {
        const radiusX = Math.abs(x - startX) / 2;
        const radiusY = Math.abs(y - startY) / 2;
        const centerX = startX + (x - startX) / 2;
        const centerY = startY + (y - startY) / 2;
        tempCtx.beginPath();
        tempCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        tempCtx.stroke();
      }
    }
    
    lastX = x;
    lastY = y;
  }
  
  function handleMouseUp(e) {
    if (!isDrawing) return;
    isDrawing = false;
    
    const endX = e.clientX;
    const endY = e.clientY;
    
    // Clear temp canvas
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw final shape on main canvas
    annotationCtx.strokeStyle = currentColor;
    annotationCtx.lineWidth = brushSize;
    
    if (currentTool === 'arrow') {
      drawArrowOnCtx(annotationCtx, startX, startY, endX, endY);
    } else if (currentTool === 'line') {
      annotationCtx.beginPath();
      annotationCtx.moveTo(startX, startY);
      annotationCtx.lineTo(endX, endY);
      annotationCtx.stroke();
    } else if (currentTool === 'rectangle') {
      annotationCtx.strokeRect(startX, startY, endX - startX, endY - startY);
    } else if (currentTool === 'circle') {
      const radiusX = Math.abs(endX - startX) / 2;
      const radiusY = Math.abs(endY - startY) / 2;
      const centerX = startX + (endX - startX) / 2;
      const centerY = startY + (endY - startY) / 2;
      annotationCtx.beginPath();
      annotationCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      annotationCtx.stroke();
    }
    
    // Save to history after any drawing action
    saveToHistory();
  }
  
  function handleMouseLeave() {
    if (isDrawing && (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser')) {
      isDrawing = false;
      saveToHistory();
    }
  }
  
  // Touch handlers
  function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    handleMouseDown(mouseEvent);
  }
  
  function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    handleMouseMove(mouseEvent);
  }
  
  function handleTouchEnd(e) {
    const mouseEvent = new MouseEvent('mouseup', {
      clientX: lastX,
      clientY: lastY
    });
    handleMouseUp(mouseEvent);
  }
  
  // Text input
  function showTextInput(x, y) {
    if (textInput) textInput.remove();
    
    textInput = document.createElement('input');
    textInput.id = 'snaprecord-text-input';
    textInput.type = 'text';
    textInput.placeholder = 'Type text...';
    textInput.style.left = x + 'px';
    textInput.style.top = y + 'px';
    textInput.style.color = currentColor;
    document.body.appendChild(textInput);
    textInput.focus();
    
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = textInput.value.trim();
        if (text) {
          annotationCtx.fillStyle = currentColor;
          annotationCtx.font = `${brushSize * 4 + 12}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
          annotationCtx.fillText(text, x, y + (brushSize * 4 + 12));
          saveToHistory();
        }
        textInput.remove();
        textInput = null;
      } else if (e.key === 'Escape') {
        textInput.remove();
        textInput = null;
      }
    });
    
    textInput.addEventListener('blur', () => {
      if (textInput) {
        const text = textInput.value.trim();
        if (text) {
          annotationCtx.fillStyle = currentColor;
          annotationCtx.font = `${brushSize * 4 + 12}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
          annotationCtx.fillText(text, x, y + (brushSize * 4 + 12));
          saveToHistory();
        }
        textInput.remove();
        textInput = null;
      }
    });
  }
}

function drawArrowOnCtx(ctx, fromX, fromY, toX, toY) {
  const headLength = 15 + brushSize;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  
  // Line
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  
  // Arrow head
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
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
  drawArrowOnCtx(annotationCtx, fromX, fromY, toX, toY);
}

function removeAnnotationTools() {
  // Remove keyboard event listener
  if (keyboardHandler) {
    document.removeEventListener('keydown', keyboardHandler);
    keyboardHandler = null;
  }
  
  // Remove resize listener
  window.removeEventListener('resize', handleCanvasResize);
  
  if (annotationCanvas) {
    annotationCanvas.remove();
    annotationCanvas = null;
    annotationCtx = null;
  }
  if (tempCanvas) {
    tempCanvas.remove();
    tempCanvas = null;
    tempCtx = null;
  }
  if (annotationToolbar) {
    annotationToolbar.remove();
    annotationToolbar = null;
  }
  const style = document.getElementById('snaprecord-annotation-styles');
  if (style) style.remove();
  
  const showBtn = document.getElementById('snaprecord-show-toolbar-btn');
  if (showBtn) showBtn.remove();
  
  const textInput = document.getElementById('snaprecord-text-input');
  if (textInput) textInput.remove();
  
  // Reset state
  drawingHistory = [];
  historyIndex = -1;
  isToolbarVisible = true;
  isToolbarMinimized = false;
  isDrawingEnabled = false;
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
  
  // Annotation tools control
  if (request.action === 'showAnnotationTools') {
    if (annotationToolbar) {
      showToolbar();
    } else {
      createAnnotationTools();
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'hideAnnotationTools') {
    if (annotationToolbar) {
      hideToolbar();
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'toggleDrawingMode') {
    if (annotationToolbar) {
      toggleDrawingMode();
    }
    sendResponse({ success: true, isEnabled: isDrawingEnabled });
    return true;
  }
  
  if (request.action === 'getAnnotationState') {
    sendResponse({
      success: true,
      hasTools: !!annotationToolbar,
      isVisible: isToolbarVisible,
      isDrawingEnabled: isDrawingEnabled
    });
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
      audio: options.audioEnabled,
      // Suppress the browser's built-in control bar
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      systemAudio: 'include',
      surfaceSwitching: 'exclude',
      monitorTypeSurfaces: 'include'
    };

    // Use CaptureController to hide the focus indicator and control bar if supported
    let controller = null;
    if (typeof CaptureController !== 'undefined') {
      controller = new CaptureController();
      controller.setFocusBehavior('no-focus-change');
    }

    // Get display media stream
    try {
      const displayOptions = { ...constraints };
      if (controller) {
        displayOptions.controller = controller;
      }
      currentStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
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
  // Show countdown after user has selected what to capture
  const countdownSeconds = parseInt(options.countdownSeconds) || 0;
  
  const startActualRecording = () => {
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
  };
  
  // Show countdown if enabled, then start recording
  if (countdownSeconds > 0) {
    showCountdown(countdownSeconds).then(startActualRecording);
  } else {
    startActualRecording();
  }
}

})(); // End of IIFE
