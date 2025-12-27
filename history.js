// History page JavaScript

const historyList = document.getElementById('historyList');
const emptyState = document.getElementById('emptyState');
const clearAllBtn = document.getElementById('clearAllBtn');
const totalRecordings = document.getElementById('totalRecordings');
const totalDuration = document.getElementById('totalDuration');

// Load and display history
async function loadHistory() {
  const { recordingHistory = [] } = await chrome.storage.local.get('recordingHistory');
  
  if (recordingHistory.length === 0) {
    emptyState.style.display = 'flex';
    totalRecordings.textContent = '0';
    totalDuration.textContent = '0:00:00';
    return;
  }
  
  emptyState.style.display = 'none';
  
  // Update stats
  totalRecordings.textContent = recordingHistory.length;
  const totalSecs = recordingHistory.reduce((sum, r) => sum + (r.duration || 0), 0);
  totalDuration.textContent = formatDuration(totalSecs);
  
  // Sort by date, newest first
  recordingHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Render list
  historyList.innerHTML = '';
  recordingHistory.forEach((recording, index) => {
    const item = createHistoryItem(recording, index);
    historyList.appendChild(item);
  });
}

function createHistoryItem(recording, index) {
  const div = document.createElement('div');
  div.className = 'history-item';
  div.innerHTML = `
    <div class="history-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    </div>
    <div class="history-info">
      <div class="history-filename">${recording.filename || 'Untitled Recording'}</div>
      <div class="history-meta">
        <span>${formatDate(recording.date)}</span>
        <span>${formatDuration(recording.duration || 0)}</span>
        <span>${recording.quality || '1080'}p</span>
      </div>
    </div>
    <div class="history-actions">
      <button class="btn-icon delete" data-index="${index}" title="Delete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;
  
  // Add delete handler
  div.querySelector('.delete').addEventListener('click', () => deleteRecording(index));
  
  return div;
}

async function deleteRecording(index) {
  if (!confirm('Are you sure you want to delete this recording from history?')) return;
  
  const { recordingHistory = [] } = await chrome.storage.local.get('recordingHistory');
  recordingHistory.splice(index, 1);
  await chrome.storage.local.set({ recordingHistory });
  loadHistory();
}

async function clearAllHistory() {
  if (!confirm('Are you sure you want to clear all recording history?')) return;
  
  await chrome.storage.local.set({ recordingHistory: [] });
  loadHistory();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Event listeners
clearAllBtn.addEventListener('click', clearAllHistory);

// Load on page load
document.addEventListener('DOMContentLoaded', loadHistory);
