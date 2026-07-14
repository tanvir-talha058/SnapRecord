// History page JavaScript

const historyList = document.getElementById('historyList');
const emptyState = document.getElementById('emptyState');
const clearAllBtn = document.getElementById('clearAllBtn');
const totalRecordings = document.getElementById('totalRecordings');
const totalDuration = document.getElementById('totalDuration');

/**
 * Returns the stored history sorted newest first.
 * The same ordering is used for rendering and deletion so indexes always match.
 */
async function getSortedHistory() {
  const { recordingHistory = [] } = await chrome.storage.local.get('recordingHistory');
  return recordingHistory
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Load and display history
async function loadHistory() {
  const history = await getSortedHistory();

  historyList.innerHTML = '';

  if (history.length === 0) {
    emptyState.style.display = 'flex';
    clearAllBtn.disabled = true;
    totalRecordings.textContent = '0';
    totalDuration.textContent = '0:00:00';
    return;
  }

  emptyState.style.display = 'none';
  clearAllBtn.disabled = false;

  // Update stats
  totalRecordings.textContent = history.length;
  const totalSecs = history.reduce((sum, r) => sum + (r.duration || 0), 0);
  totalDuration.textContent = formatDuration(totalSecs);

  history.forEach((recording, index) => {
    historyList.appendChild(createHistoryItem(recording, index));
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
      <div class="history-filename"></div>
      <div class="history-meta">
        <span class="meta-date"></span>
        <span class="meta-duration"></span>
        <span class="meta-quality"></span>
      </div>
    </div>
    <div class="history-actions">
      <button class="btn-icon delete" title="Delete" aria-label="Delete recording from history">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;

  // Text set via textContent so stored values can never be parsed as HTML
  div.querySelector('.history-filename').textContent = recording.filename || 'Untitled Recording';
  div.querySelector('.meta-date').textContent = formatDate(recording.date);
  div.querySelector('.meta-duration').textContent = formatDuration(recording.duration || 0);
  div.querySelector('.meta-quality').textContent = `${recording.quality || '1080'}p`;

  div.querySelector('.delete').addEventListener('click', () => deleteRecording(index));

  return div;
}

async function deleteRecording(index) {
  if (!confirm('Are you sure you want to delete this recording from history?')) return;

  const history = await getSortedHistory();
  history.splice(index, 1);
  await chrome.storage.local.set({ recordingHistory: history });
  loadHistory();
}

async function clearAllHistory() {
  if (!confirm('Are you sure you want to clear all recording history?')) return;

  await chrome.storage.local.set({ recordingHistory: [] });
  loadHistory();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Unknown date';
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
  const secs = Math.floor(seconds % 60);
  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Event listeners
clearAllBtn.addEventListener('click', clearAllHistory);

// Load on page load
document.addEventListener('DOMContentLoaded', loadHistory);
