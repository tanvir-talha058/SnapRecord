// Runs inside a hidden iframe embedded by content.js in the recorded page.
// Receives MediaRecorder chunks via postMessage (Blobs transfer natively)
// and persists them to extension-origin IndexedDB so a tab crash or
// navigation never loses a recording.
(async () => {
  'use strict';

  const RETENTION_MAX_BYTES = 500 * 1024 * 1024;

  try {
    await SnapRecordDB.openDB();
  } catch (error) {
    console.warn('SnapRecord bridge: IndexedDB unavailable, persistence disabled.', error);
    return; // never signal ready; content script stays memory-only
  }

  window.addEventListener('message', async (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    if (!msg.type.startsWith('snaprecord-')) return;
    if (event.source !== window.parent) return;

    try {
      switch (msg.type) {
        case 'snaprecord-create-session':
          await SnapRecordDB.createSession(msg.session);
          break;

        case 'snaprecord-chunk':
          await SnapRecordDB.appendChunk(msg.sessionId, msg.seq, msg.blob);
          await SnapRecordDB.updateSession(msg.sessionId, { lastChunkAt: Date.now(), lastSeq: msg.seq });
          break;

        case 'snaprecord-finalize': {
          await SnapRecordDB.finalizeSession(msg.sessionId, {
            blob: msg.blob,
            filename: msg.filename,
            durationMs: msg.durationMs,
            sizeBytes: msg.blob ? msg.blob.size : 0
          });
          const { previewCount = '3' } = await chrome.storage.sync.get('previewCount');
          await SnapRecordDB.enforceRetention(parseInt(previewCount, 10) || 0, RETENTION_MAX_BYTES);
          break;
        }

        case 'snaprecord-discard':
          await SnapRecordDB.deleteSession(msg.sessionId);
          break;
      }
    } catch (error) {
      // Persistence is best-effort; recording in the parent continues regardless.
      console.warn('SnapRecord bridge error:', error);
    }
  });

  window.parent.postMessage({ type: 'snaprecord-bridge-ready' }, '*');
})();
