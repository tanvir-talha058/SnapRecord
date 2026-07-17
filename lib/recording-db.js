// Extension-origin IndexedDB storage for recording sessions and chunks.
// Used by storage-bridge.js (writes during recording), popup.js (recovery),
// and history.js (previews). Pure helpers are unit-tested in Jest.
(function (global) {
  'use strict';

  const DB_NAME = 'snaprecord';
  const DB_VERSION = 1;
  const ORPHAN_IDLE_MS = 10000;

  // Pure: which finalized sessions to evict, newest kept first.
  function selectSessionsToEvict(sessions, maxCount, maxBytes) {
    const sorted = sessions.slice().sort((a, b) => (b.finalizedAt || 0) - (a.finalizedAt || 0));
    const evict = [];
    let totalBytes = 0;
    sorted.forEach((session, index) => {
      totalBytes += session.sizeBytes || 0;
      if (index >= maxCount || totalBytes > maxBytes) evict.push(session.id);
    });
    return evict;
  }

  // Pure: an orphan is an unfinalized session that stopped receiving chunks.
  function isOrphan(session, now) {
    if (!session || session.state !== 'recording') return false;
    const lastActivity = session.lastChunkAt || session.startedAt || 0;
    return now - lastActivity > ORPHAN_IDLE_MS;
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chunks')) {
          const chunks = db.createObjectStore('chunks', { keyPath: ['sessionId', 'seq'] });
          chunks.createIndex('bySession', 'sessionId');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withDB(run) {
    const db = await openDB();
    try {
      return await run(db);
    } finally {
      db.close();
    }
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function writeTx(db, storeName, run) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      run(transaction.objectStore(storeName), transaction);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function createSession(session) {
    return withDB((db) => writeTx(db, 'sessions', (store) => store.put(session)));
  }

  function updateSession(id, patch) {
    return withDB((db) => writeTx(db, 'sessions', (store) => {
      const get = store.get(id);
      get.onsuccess = () => {
        if (get.result) store.put(Object.assign(get.result, patch));
      };
    }));
  }

  function appendChunk(sessionId, seq, blob) {
    return withDB((db) => writeTx(db, 'chunks', (store) => store.put({ sessionId, seq, blob })));
  }

  async function finalizeSession(id, { blob, filename, durationMs, sizeBytes }) {
    await updateSession(id, {
      state: 'finalized',
      finalizedAt: Date.now(),
      blob,
      filename,
      durationMs,
      sizeBytes
    });
    await deleteChunks(id);
  }

  async function getAllSessions() {
    const sessions = await withDB((db) =>
      requestToPromise(db.transaction(['sessions']).objectStore('sessions').getAll())
    );
    return sessions || [];
  }

  async function getRecordingSessions() {
    const sessions = await getAllSessions();
    return sessions.filter((s) => s.state === 'recording');
  }

  async function getFinalizedSessions() {
    const sessions = await getAllSessions();
    return sessions
      .filter((s) => s.state === 'finalized')
      .sort((a, b) => (b.finalizedAt || 0) - (a.finalizedAt || 0));
  }

  async function getChunks(sessionId) {
    const rows = await withDB((db) =>
      requestToPromise(
        db.transaction(['chunks']).objectStore('chunks').index('bySession').getAll(sessionId)
      )
    );
    return (rows || []).sort((a, b) => a.seq - b.seq).map((row) => row.blob);
  }

  function deleteChunks(sessionId) {
    return withDB((db) => writeTx(db, 'chunks', (store) => {
      const request = store.index('bySession').openKeyCursor(global.IDBKeyRange.only(sessionId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    }));
  }

  async function deleteSession(id) {
    await deleteChunks(id);
    await withDB((db) => writeTx(db, 'sessions', (store) => store.delete(id)));
  }

  async function enforceRetention(maxCount, maxBytes) {
    const finalized = await getFinalizedSessions();
    const evict = selectSessionsToEvict(finalized, maxCount, maxBytes);
    for (const id of evict) {
      await deleteSession(id);
    }
  }

  // Deletes unfinalized sessions that are older than maxAgeMs (finalized
  // sessions are governed by enforceRetention instead).
  async function purgeOldSessions(maxAgeMs) {
    const now = Date.now();
    const sessions = await getAllSessions();
    for (const session of sessions) {
      if (session.state === 'finalized') continue;
      const lastActivity = session.lastChunkAt || session.startedAt || 0;
      if (now - lastActivity > maxAgeMs) {
        await deleteSession(session.id);
      }
    }
  }

  const api = {
    ORPHAN_IDLE_MS,
    selectSessionsToEvict,
    isOrphan,
    openDB,
    createSession,
    updateSession,
    appendChunk,
    finalizeSession,
    getRecordingSessions,
    getFinalizedSessions,
    getChunks,
    deleteSession,
    enforceRetention,
    purgeOldSessions
  };

  global.SnapRecordDB = api;
  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
