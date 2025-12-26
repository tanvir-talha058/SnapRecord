// Shared utility functions for SnapRecord extension

/**
 * Generate a timestamped filename for recordings
 * @returns {string} Filename in format: SnapRecord_YYYY-MM-DD_HH-MM-SS.webm
 */
function generateRecordingFilename() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `SnapRecord_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.webm`;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateRecordingFilename };
}
