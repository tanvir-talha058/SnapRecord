// Handle getDisplayMedia requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDisplayMedia') {
    handleGetDisplayMedia(request.options)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open
  }
});

async function handleGetDisplayMedia(options) {
  try {
    const constraints = {
      audio: options.audio || false,
      video: {
        displaySurface: options.video?.displaySurface || 'monitor'
      }
    };

    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    
    // Note: We can't directly pass the stream object through message passing
    // So we'll need to handle this differently in the actual implementation
    // For now, we'll store it temporarily
    
    return { 
      success: true,
      streamId: stream.id
    };
  } catch (error) {
    console.error('Error getting display media:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}
