# SnapRecord v1.2 Reliability + Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SnapRecord crash-proof (IndexedDB chunk persistence + recovery), produce seekable WebM files, remove dishonest format options, add history previews, and market its 100%-local privacy — per `docs/superpowers/specs/2026-07-17-reliability-privacy-design.md`.

**Architecture:** Recording stays in the recorded tab's content script. A hidden extension iframe (`storage-bridge.html`) receives MediaRecorder chunks via `postMessage` (Blobs transfer natively) and mirrors them into extension-origin IndexedDB. Popup/history pages read that DB directly (they are extension pages). A dependency-free EBML patcher fixes WebM duration before every download.

**Tech Stack:** Vanilla JS, Chrome MV3 APIs, IndexedDB, Jest (node env, already configured). Zero runtime dependencies — this is a product constraint.

## Global Constraints

- Zero external runtime dependencies (no npm packages shipped; test-only devDeps OK).
- All new lib files are plain scripts exposing a global (`SnapRecordDB`, `SnapRecordWebM`) AND `module.exports` when `module` exists (same pattern as `background.js:475-487`) so Jest can require them.
- Persistence must NEVER block or break recording: every bridge/DB failure degrades to today's memory-only behavior.
- Chunk timeslice: 2000 ms (`TIMESLICE_MS`).
- Retention defaults: keep last **3** finalized recordings, total cap **500 MB** (500 * 1024 * 1024 bytes).
- Orphan idle threshold: **10 000 ms**; stale-session purge age: **7 days**.
- Version bumps to **1.2.0** (manifest.json, package.json, options.html About).
- Run tests with `npm test`, lint with `npx eslint .` (from repo root, PowerShell).

---

### Task 1: WebM duration patcher (`lib/webm-duration-fix.js`)

MediaRecorder WebM output has no `Segment > Info > Duration` element, so players show `Infinity` and can't seek. This task adds a pure, dependency-free patcher.

**Files:**
- Create: `lib/webm-duration-fix.js`
- Test: `tests/webm-duration-fix.test.js`

**Interfaces:**
- Produces: global/`module.exports` object `SnapRecordWebM` with:
  - `patchWebMDuration(input: ArrayBuffer|Uint8Array, durationMs: number) -> Uint8Array | null` — returns patched copy, or `null` when input can't be safely patched (caller falls back to original).
  - `fixBlobDuration(blob: Blob, durationMs: number) -> Promise<Blob>` — Blob convenience wrapper; returns the ORIGINAL blob on any failure (never throws).

- [ ] **Step 1: Write the failing test**

Create `tests/webm-duration-fix.test.js`:

```js
const { patchWebMDuration } = require('../lib/webm-duration-fix');

// --- Synthetic WebM builders -------------------------------------------------
function bytes(...parts) {
  const flat = [];
  for (const part of parts) flat.push(...part);
  return new Uint8Array(flat);
}

const EBML_HEADER = [0x1A, 0x45, 0xDF, 0xA3, 0x84, 0x00, 0x00, 0x00, 0x00]; // 4 dummy content bytes
const SEGMENT_UNKNOWN = [0x18, 0x53, 0x80, 0x67, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
const CLUSTER_EMPTY = [0x1F, 0x43, 0xB6, 0x75, 0x80];

function timecodeScaleElement(ns) {
  // 0x2AD7B1, 3-byte uint payload
  return [0x2A, 0xD7, 0xB1, 0x83, (ns >> 16) & 0xFF, (ns >> 8) & 0xFF, ns & 0xFF];
}

function infoElement(contentBytes) {
  if (contentBytes.length > 126) throw new Error('test helper: content too long');
  return [0x15, 0x49, 0xA9, 0x66, 0x80 | contentBytes.length, ...contentBytes];
}

function durationElement(f64Value) {
  const buf = new Uint8Array(11);
  buf.set([0x44, 0x89, 0x88], 0);
  new DataView(buf.buffer).setFloat64(3, f64Value);
  return Array.from(buf);
}

// Finds Duration (0x44 0x89 0x88 + 8 bytes) anywhere in the file, returns f64.
function readDurationFrom(data) {
  for (let i = 0; i + 11 <= data.length; i++) {
    if (data[i] === 0x44 && data[i + 1] === 0x89 && data[i + 2] === 0x88) {
      return new DataView(data.buffer, data.byteOffset + i + 3, 8).getFloat64(0);
    }
  }
  return null;
}

describe('patchWebMDuration', () => {
  test('inserts Duration when missing (default 1ms timecode scale)', () => {
    const input = bytes(EBML_HEADER, SEGMENT_UNKNOWN,
      infoElement(timecodeScaleElement(1000000)), CLUSTER_EMPTY);
    const out = patchWebMDuration(input, 12345);
    expect(out).not.toBeNull();
    expect(readDurationFrom(out)).toBeCloseTo(12345);
    // Cluster must survive at the end of the file
    expect(Array.from(out.slice(-CLUSTER_EMPTY.length))).toEqual(CLUSTER_EMPTY);
  });

  test('rewrites an existing Duration in place without changing length', () => {
    const input = bytes(EBML_HEADER, SEGMENT_UNKNOWN,
      infoElement([...timecodeScaleElement(1000000), ...durationElement(0)]), CLUSTER_EMPTY);
    const out = patchWebMDuration(input, 60000);
    expect(out).not.toBeNull();
    expect(out.length).toBe(input.length);
    expect(readDurationFrom(out)).toBeCloseTo(60000);
  });

  test('respects a non-default timecode scale', () => {
    // 500,000 ns per tick => ticks = ms * 2
    const input = bytes(EBML_HEADER, SEGMENT_UNKNOWN,
      infoElement(timecodeScaleElement(500000)), CLUSTER_EMPTY);
    const out = patchWebMDuration(input, 1000);
    expect(readDurationFrom(out)).toBeCloseTo(2000);
  });

  test('returns null for garbage input', () => {
    expect(patchWebMDuration(new Uint8Array([1, 2, 3]), 1000)).toBeNull();
  });

  test('returns null for non-positive duration', () => {
    const input = bytes(EBML_HEADER, SEGMENT_UNKNOWN,
      infoElement(timecodeScaleElement(1000000)), CLUSTER_EMPTY);
    expect(patchWebMDuration(input, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/webm-duration-fix.test.js`
Expected: FAIL — `Cannot find module '../lib/webm-duration-fix'`

- [ ] **Step 3: Write the implementation**

Create `lib/webm-duration-fix.js`:

```js
// Dependency-free patcher for the missing Duration element in MediaRecorder
// WebM output. Without it, players report Infinity and cannot seek.
// Loaded as a plain script (content script / extension pages) and via
// require() in Jest.
(function (global) {
  'use strict';

  const ID_SEGMENT = [0x18, 0x53, 0x80, 0x67];
  const ID_INFO = [0x15, 0x49, 0xA9, 0x66];
  const ID_TIMECODE_SCALE = [0x2A, 0xD7, 0xB1];
  const ID_DURATION = [0x44, 0x89];

  function vintLength(firstByte) {
    for (let i = 0; i < 8; i++) {
      if (firstByte & (0x80 >> i)) return i + 1;
    }
    return -1;
  }

  function readId(data, pos) {
    if (pos >= data.length) return null;
    const length = vintLength(data[pos]);
    if (length < 1 || length > 4 || pos + length > data.length) return null;
    return { length, bytes: data.subarray(pos, pos + length) };
  }

  function readSize(data, pos) {
    if (pos >= data.length) return null;
    const length = vintLength(data[pos]);
    if (length < 1 || length > 8 || pos + length > data.length) return null;
    let value = data[pos] & (0xFF >> length);
    let unknown = value === (0xFF >> length);
    for (let i = 1; i < length; i++) {
      value = value * 256 + data[pos + i];
      if (data[pos + i] !== 0xFF) unknown = false;
    }
    return { length, value, unknown };
  }

  function idMatches(idBytes, expected) {
    if (!idBytes || idBytes.length !== expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (idBytes[i] !== expected[i]) return false;
    }
    return true;
  }

  function readUint(data, pos, length) {
    let value = 0;
    for (let i = 0; i < length; i++) value = value * 256 + data[pos + i];
    return value;
  }

  // Fixed 8-byte EBML size vint (values < 2^56).
  function encodeSize8(value) {
    const bytes = new Uint8Array(8);
    bytes[0] = 0x01;
    for (let i = 7; i >= 1; i--) {
      bytes[i] = value % 256;
      value = Math.floor(value / 256);
    }
    return bytes;
  }

  function patchWebMDuration(input, durationMs) {
    const data = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (!(durationMs > 0)) return null;

    // Top level: skip elements until the Segment.
    let pos = 0;
    let segmentUnknownSize = false;
    let segmentContentStart = -1;
    let segmentContentEnd = data.length;
    while (pos < data.length) {
      const id = readId(data, pos);
      if (!id) return null;
      const size = readSize(data, pos + id.length);
      if (!size) return null;
      const contentStart = pos + id.length + size.length;
      if (idMatches(id.bytes, ID_SEGMENT)) {
        segmentUnknownSize = size.unknown;
        segmentContentStart = contentStart;
        if (!size.unknown) segmentContentEnd = contentStart + size.value;
        break;
      }
      if (size.unknown) return null; // only the Segment may be unknown-size
      pos = contentStart + size.value;
    }
    if (segmentContentStart < 0) return null;

    // Segment children: find Info.
    pos = segmentContentStart;
    while (pos < segmentContentEnd) {
      const id = readId(data, pos);
      if (!id) return null;
      const size = readSize(data, pos + id.length);
      if (!size || size.unknown) return null;
      const contentStart = pos + id.length + size.length;
      if (idMatches(id.bytes, ID_INFO)) {
        return patchInfo(data, pos, id.length, contentStart, size.value, durationMs, segmentUnknownSize);
      }
      pos = contentStart + size.value;
    }
    return null;
  }

  function patchInfo(data, infoStart, infoIdLength, contentStart, contentSize, durationMs, allowInsert) {
    const contentEnd = contentStart + contentSize;
    if (contentEnd > data.length) return null;
    let timecodeScale = 1000000; // ns per tick; WebM default = 1 ms
    let durationPos = -1;
    let durationSize = 0;

    let pos = contentStart;
    while (pos < contentEnd) {
      const id = readId(data, pos);
      if (!id) return null;
      const size = readSize(data, pos + id.length);
      if (!size || size.unknown) return null;
      const valueStart = pos + id.length + size.length;
      if (idMatches(id.bytes, ID_TIMECODE_SCALE)) {
        timecodeScale = readUint(data, valueStart, size.value);
      } else if (idMatches(id.bytes, ID_DURATION)) {
        durationPos = valueStart;
        durationSize = size.value;
      }
      pos = valueStart + size.value;
    }

    const durationTicks = (durationMs * 1000000) / timecodeScale;

    if (durationPos >= 0) {
      if (durationSize !== 4 && durationSize !== 8) return null;
      const out = data.slice();
      const view = new DataView(out.buffer, out.byteOffset + durationPos, durationSize);
      if (durationSize === 8) view.setFloat64(0, durationTicks);
      else view.setFloat32(0, durationTicks);
      return out;
    }

    // Inserting grows Info, which is only safe when the Segment size is
    // unknown (always true for MediaRecorder output).
    if (!allowInsert) return null;

    const durationElement = new Uint8Array(11);
    durationElement.set([ID_DURATION[0], ID_DURATION[1], 0x88], 0);
    new DataView(durationElement.buffer).setFloat64(3, durationTicks);

    const newSizeBytes = encodeSize8(contentSize + durationElement.length);
    const head = data.subarray(0, infoStart + infoIdLength);
    const body = data.subarray(contentStart, contentEnd);
    const tail = data.subarray(contentEnd);

    const out = new Uint8Array(head.length + newSizeBytes.length + body.length + durationElement.length + tail.length);
    let offset = 0;
    for (const part of [head, newSizeBytes, body, durationElement, tail]) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  async function fixBlobDuration(blob, durationMs) {
    try {
      const buffer = await blob.arrayBuffer();
      const patched = patchWebMDuration(new Uint8Array(buffer), durationMs);
      return patched ? new Blob([patched], { type: blob.type }) : blob;
    } catch (_e) {
      return blob;
    }
  }

  const api = { patchWebMDuration, fixBlobDuration };
  global.SnapRecordWebM = api;
  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/webm-duration-fix.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Lint and commit**

Run: `npx eslint lib/webm-duration-fix.js tests/webm-duration-fix.test.js`
(If eslint complains about unknown globals like `DataView`/`self`, extend `eslint.config.js` globals for `lib/**` with `globals.browser` — inspect the existing config and follow its pattern.)

```
git add lib/webm-duration-fix.js tests/webm-duration-fix.test.js eslint.config.js
git commit -m "feat: add dependency-free WebM duration patcher"
```

---

### Task 2: Recording database (`lib/recording-db.js`)

Extension-origin IndexedDB layer shared by the storage bridge, popup, and history pages.

**Files:**
- Create: `lib/recording-db.js`
- Test: `tests/recording-db.test.js`

**Interfaces:**
- Produces: global/`module.exports` object `SnapRecordDB` with:
  - Pure (unit-tested): `selectSessionsToEvict(sessions, maxCount, maxBytes) -> string[]`, `isOrphan(session, now) -> boolean`, `ORPHAN_IDLE_MS` (10000).
  - DB (browser only): `openDB()`, `createSession(session)`, `updateSession(id, patch)`, `appendChunk(sessionId, seq, blob)`, `finalizeSession(id, {blob, filename, durationMs, sizeBytes})`, `getRecordingSessions()`, `getFinalizedSessions()` (newest first), `getChunks(sessionId) -> Promise<Blob[]>` (seq order), `deleteSession(id)`, `enforceRetention(maxCount, maxBytes)`, `purgeOldSessions(maxAgeMs)`.
- Session record shape: `{ id, startedAt, state: 'recording'|'finalized', mimeType, quality, format, lastChunkAt?, lastSeq?, finalizedAt?, blob?, filename?, durationMs?, sizeBytes? }`.

- [ ] **Step 1: Write the failing test**

Create `tests/recording-db.test.js`:

```js
const { selectSessionsToEvict, isOrphan, ORPHAN_IDLE_MS } = require('../lib/recording-db');

describe('selectSessionsToEvict', () => {
  const mb = (n) => n * 1024 * 1024;
  const session = (id, finalizedAt, sizeBytes) => ({ id, finalizedAt, sizeBytes });

  test('keeps everything under both limits', () => {
    const sessions = [session('a', 3, mb(10)), session('b', 2, mb(10))];
    expect(selectSessionsToEvict(sessions, 3, mb(100))).toEqual([]);
  });

  test('evicts oldest beyond maxCount', () => {
    const sessions = [session('old', 1, mb(1)), session('mid', 2, mb(1)), session('new', 3, mb(1))];
    expect(selectSessionsToEvict(sessions, 2, mb(100))).toEqual(['old']);
  });

  test('evicts oldest once total size exceeds maxBytes', () => {
    const sessions = [session('old', 1, mb(300)), session('new', 2, mb(300))];
    expect(selectSessionsToEvict(sessions, 5, mb(500))).toEqual(['old']);
  });

  test('maxCount of 0 evicts all', () => {
    const sessions = [session('a', 1, mb(1))];
    expect(selectSessionsToEvict(sessions, 0, mb(500))).toEqual(['a']);
  });

  test('treats missing sizeBytes as 0', () => {
    const sessions = [session('a', 2, undefined), session('b', 1, undefined)];
    expect(selectSessionsToEvict(sessions, 2, mb(500))).toEqual([]);
  });
});

describe('isOrphan', () => {
  const now = 1_000_000;

  test('recording session idle past threshold is an orphan', () => {
    expect(isOrphan({ state: 'recording', startedAt: 0, lastChunkAt: now - ORPHAN_IDLE_MS - 1 }, now)).toBe(true);
  });

  test('recently active recording session is not an orphan', () => {
    expect(isOrphan({ state: 'recording', startedAt: 0, lastChunkAt: now - 2000 }, now)).toBe(false);
  });

  test('finalized session is never an orphan', () => {
    expect(isOrphan({ state: 'finalized', startedAt: 0, lastChunkAt: 0 }, now)).toBe(false);
  });

  test('falls back to startedAt when no chunk ever arrived', () => {
    expect(isOrphan({ state: 'recording', startedAt: now - ORPHAN_IDLE_MS - 1 }, now)).toBe(true);
  });

  test('null session is not an orphan', () => {
    expect(isOrphan(null, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/recording-db.test.js`
Expected: FAIL — `Cannot find module '../lib/recording-db'`

- [ ] **Step 3: Write the implementation**

Create `lib/recording-db.js`:

```js
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
    return withDB((db) =>
      requestToPromise(db.transaction(['sessions']).objectStore('sessions').getAll())
    ).then((sessions) => sessions || []);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/recording-db.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Lint and commit**

Run: `npx eslint lib/recording-db.js tests/recording-db.test.js`

```
git add lib/recording-db.js tests/recording-db.test.js
git commit -m "feat: add IndexedDB session/chunk store with retention + orphan helpers"
```

---

### Task 3: Storage bridge page + manifest wiring

**Files:**
- Create: `storage-bridge.html`
- Create: `storage-bridge.js`
- Modify: `manifest.json` (add `web_accessible_resources`)

**Interfaces:**
- Consumes: `SnapRecordDB` from Task 2.
- Produces: a page that, embedded as an iframe by the content script, handles these `postMessage` payloads from its parent window:
  - `{ type: 'snaprecord-create-session', session }` — store session record.
  - `{ type: 'snaprecord-chunk', sessionId, seq, blob }` — persist chunk, bump `lastChunkAt`/`lastSeq`.
  - `{ type: 'snaprecord-finalize', sessionId, blob, filename, durationMs }` — mark finalized, store final blob, delete chunks, run retention.
  - `{ type: 'snaprecord-discard', sessionId }` — delete session + chunks.
  - On successful init it posts `{ type: 'snaprecord-bridge-ready' }` to `window.parent`.

- [ ] **Step 1: Create `storage-bridge.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SnapRecord Storage Bridge</title>
</head>
<body>
  <script src="lib/recording-db.js"></script>
  <script src="storage-bridge.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `storage-bridge.js`**

```js
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
```

- [ ] **Step 3: Add `web_accessible_resources` to `manifest.json`**

After the `"options_page"` line, add:

```json
"web_accessible_resources": [
  {
    "resources": ["storage-bridge.html"],
    "matches": ["<all_urls>"]
  }
],
```

- [ ] **Step 4: Verify extension still loads**

Load/reload the unpacked extension at `chrome://extensions` — no manifest errors. Open `chrome-extension://<id>/storage-bridge.html` directly in a tab; console shows no errors.

- [ ] **Step 5: Lint and commit**

Run: `npx eslint storage-bridge.js`

```
git add storage-bridge.html storage-bridge.js manifest.json
git commit -m "feat: add extension-origin storage bridge iframe for chunk persistence"
```

---

### Task 4: Wire content script to the bridge (crash-proof chunks + duration fix)

**Files:**
- Modify: `content.js` (`startRecordingInContent` at ~1690, `mediaRecorder.ondataavailable`/`onstop` at ~1765-1806, `mediaRecorder.start(1000)` at ~1849, `saveRecordingToHistory` at ~1824)
- Modify: `background.js:259-262` (inject lib alongside content.js)

**Interfaces:**
- Consumes: bridge messages from Task 3; `SnapRecordWebM.fixBlobDuration(blob, durationMs)` from Task 1.
- Produces: history entries now include `sessionId` (used by Task 8); recordings are mirrored to IndexedDB and downloads are duration-patched.

- [ ] **Step 1: Add bridge helpers to `content.js`**

Inside the content script's main scope (near the other `let currentStream` module-level declarations), add:

```js
// --- Storage bridge (crash-proof chunk persistence) ---
const TIMESLICE_MS = 2000;
const BRIDGE_READY_TIMEOUT_MS = 1500;
let bridgeFrame = null;
let bridgeReady = false;

/**
 * Embeds the hidden extension iframe that mirrors chunks into
 * extension-origin IndexedDB. Resolves true when the bridge is ready,
 * false when unavailable (page CSP, IndexedDB failure, timeout) — in
 * which case recording proceeds memory-only exactly as before.
 */
function setupStorageBridge(session) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    try {
      bridgeFrame = document.createElement('iframe');
      bridgeFrame.src = chrome.runtime.getURL('storage-bridge.html');
      bridgeFrame.setAttribute('aria-hidden', 'true');
      bridgeFrame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none;';
      const onMessage = (event) => {
        if (bridgeFrame && event.source === bridgeFrame.contentWindow &&
            event.data && event.data.type === 'snaprecord-bridge-ready') {
          window.removeEventListener('message', onMessage);
          bridgeReady = true;
          bridgePost({ type: 'snaprecord-create-session', session });
          finish(true);
        }
      };
      window.addEventListener('message', onMessage);
      (document.body || document.documentElement).appendChild(bridgeFrame);
      setTimeout(() => {
        window.removeEventListener('message', onMessage);
        finish(bridgeReady);
      }, BRIDGE_READY_TIMEOUT_MS);
    } catch (_e) {
      finish(false);
    }
  });
}

function bridgePost(message) {
  if (bridgeReady && bridgeFrame && bridgeFrame.contentWindow) {
    try {
      bridgeFrame.contentWindow.postMessage(message, chrome.runtime.getURL('').replace(/\/$/, ''));
    } catch (_e) {
      // Page tore the frame down; recording continues memory-only.
    }
  }
}

function teardownStorageBridge() {
  const frame = bridgeFrame;
  bridgeFrame = null;
  bridgeReady = false;
  if (frame) {
    // Give the final finalize/discard message time to be processed.
    setTimeout(() => frame.remove(), 3000);
  }
}
```

- [ ] **Step 2: Feed chunks through the bridge in `startActualRecording`**

In `startRecordingInContent`, make `startActualRecording` async and set up the session before creating the recorder. Replace the current declaration `const startActualRecording = () => {` with `const startActualRecording = async () => {` and, immediately after the bitrate calculation (after `const videoBitsPerSecond = ...`), insert:

```js
      const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let chunkSeq = 0;
      await setupStorageBridge({
        id: sessionId,
        startedAt: Date.now(),
        state: 'recording',
        mimeType,
        quality: options.quality || '1080',
        format: options.format || 'webm-vp9'
      });
```

Replace the `ondataavailable` handler:

```js
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
          bridgePost({ type: 'snaprecord-chunk', sessionId, seq: chunkSeq++, blob: event.data });
        }
      };
```

Replace `mediaRecorder.start(1000);` with `mediaRecorder.start(TIMESLICE_MS);`.

- [ ] **Step 3: Patch duration and finalize in `onstop`**

Replace the body of `mediaRecorder.onstop` so it (a) flushes pause bookkeeping, (b) patches WebM duration, (c) downloads, (d) finalizes the bridge session. Full replacement:

```js
      mediaRecorder.onstop = async () => {
        if (pauseStartedAt > 0) {
          totalPausedMs += Date.now() - pauseStartedAt;
          pauseStartedAt = 0;
        }
        const recordedDurationMs = Math.max(0, Date.now() - recordingStartTime - totalPausedMs);

        let blob = new Blob(recordedChunks, { type: mimeType });
        if (mimeType.startsWith('video/webm') && typeof SnapRecordWebM !== 'undefined') {
          blob = await SnapRecordWebM.fixBlobDuration(blob, recordedDurationMs);
        }

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

        // Mark the persisted session as safely delivered
        bridgePost({
          type: 'snaprecord-finalize',
          sessionId,
          blob,
          filename,
          durationMs: recordedDurationMs
        });
        teardownStorageBridge();

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        if (currentStream === stream) {
          currentStream = null;
        }
        if (window.__snapRecordMediaRecorder === mediaRecorder) {
          window.__snapRecordMediaRecorder = null;
        }

        // Clean up camera overlay and annotation tools
        removeCameraOverlay();
        removeAnnotationTools();

        // Save to recording history
        saveRecordingToHistory(filename, options);
      };
```

Note: `recordingStartTime`, `totalPausedMs`, `pauseStartedAt` are declared AFTER the current `onstop` assignment in the existing code (`content.js:1808-1811`). Move those three declarations (and the pause/resume listeners at 1813-1821) ABOVE the `mediaRecorder.onstop = ...` assignment so `onstop` can read them.

- [ ] **Step 4: Include `sessionId` in the history entry**

In `saveRecordingToHistory` (content.js ~1824), add `sessionId` to the entry object:

```js
        const historyEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          sessionId,
          filename,
          date: new Date().toISOString(),
          duration,
          quality: options.quality || '1080',
          format: options.format || 'webm-vp9'
        };
```

- [ ] **Step 5: Inject the WebM lib with the content script**

In `background.js:259-262`, change the injection to include the lib (order matters — lib first):

```js
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['lib/webm-duration-fix.js', 'content.js']
        });
```

- [ ] **Step 6: Manual verification**

Reload the extension. Record a tab for ~15 seconds and stop normally. Verify:
1. The downloaded file plays AND is seekable with a correct duration (open in Chrome video player).
2. In DevTools on `chrome-extension://<id>/storage-bridge.html` (open it in a tab) → Application → IndexedDB → `snaprecord` → `sessions` contains one `finalized` session with a blob; `chunks` store is empty.
3. Record on a page, then kill the tab via Chrome Task Manager (Shift+Esc) mid-recording. Reopen the DB view: session is still `state: 'recording'` with chunks present (recovery UI arrives in Task 5).

- [ ] **Step 7: Run all tests, lint, commit**

Run: `npm test` and `npx eslint content.js background.js`
Expected: all pass.

```
git add content.js background.js
git commit -m "feat: mirror recording chunks to extension IndexedDB and fix WebM duration"
```

---

### Task 5: Navigation guard + popup recovery flow

**Files:**
- Modify: `content.js` (inside `startActualRecording`, and `onstop` from Task 4)
- Modify: `popup.html` (banner markup + lib scripts)
- Modify: `popup.css` (banner styles)
- Modify: `popup.js` (recovery check + actions)

**Interfaces:**
- Consumes: `SnapRecordDB` (getRecordingSessions, isOrphan, getChunks, deleteSession, purgeOldSessions), `SnapRecordWebM.fixBlobDuration`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the navigation guard to `content.js`**

Inside `startActualRecording`, right after the `mediaRecorder` is constructed (before `onstop` is assigned), add:

```js
      // Navigation guard: warn before leaving and flush a final chunk so the
      // recovery flow loses at most the last timeslice.
      const beforeUnloadHandler = (event) => {
        event.preventDefault();
        event.returnValue = '';
      };
      const pageHideHandler = () => {
        if (mediaRecorder.state === 'recording') {
          try { mediaRecorder.requestData(); } catch (_e) { /* recorder already gone */ }
        }
      };
      window.addEventListener('beforeunload', beforeUnloadHandler);
      window.addEventListener('pagehide', pageHideHandler);
```

At the very top of the `onstop` handler body (before the pause flush), add:

```js
        window.removeEventListener('beforeunload', beforeUnloadHandler);
        window.removeEventListener('pagehide', pageHideHandler);
```

- [ ] **Step 2: Add recovery banner markup to `popup.html`**

Immediately after the error banner (`<div id="errorBanner" ...>` at popup.html:298), add:

```html
    <!-- Crash recovery banner -->
    <div id="recoveryBanner" class="recovery-banner" role="alert" hidden>
      <div class="recovery-text">
        <strong>Unsaved recording found</strong>
        <span id="recoveryDetail"></span>
      </div>
      <div class="recovery-actions">
        <button id="recoverBtn" class="btn-recover" aria-label="Recover unsaved recording">Recover</button>
        <button id="discardRecoveryBtn" class="btn-discard" aria-label="Discard unsaved recording">Discard</button>
      </div>
    </div>
```

Before `<script src="popup.js"></script>` at the bottom, add:

```html
  <script src="lib/recording-db.js"></script>
  <script src="lib/webm-duration-fix.js"></script>
```

- [ ] **Step 3: Style the banner in `popup.css`**

Append (match existing variable usage if popup.css defines theme variables — inspect the top of the file and reuse its color tokens; the fallback below is self-contained):

```css
/* Crash recovery banner */
.recovery-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 8px 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 170, 0, 0.12);
  border: 1px solid rgba(255, 170, 0, 0.45);
}

.recovery-banner[hidden] {
  display: none;
}

.recovery-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.recovery-actions {
  display: flex;
  gap: 6px;
}

.btn-recover,
.btn-discard {
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.btn-recover {
  background: #ffaa00;
  color: #1a1a1a;
  font-weight: 600;
}

.btn-discard {
  background: transparent;
  color: inherit;
  border: 1px solid rgba(128, 128, 128, 0.4);
}
```

- [ ] **Step 4: Add recovery logic to `popup.js`**

Append at the end of the file:

```js
// --- Crash recovery -------------------------------------------------------
const recoveryBanner = document.getElementById('recoveryBanner');
const recoveryDetail = document.getElementById('recoveryDetail');
const recoverBtn = document.getElementById('recoverBtn');
const discardRecoveryBtn = document.getElementById('discardRecoveryBtn');
let recoverySession = null;

/**
 * Shows the recovery banner when an interrupted recording session is found
 * in extension IndexedDB (tab crash, navigation, browser restart).
 */
async function checkForRecoverableRecordings() {
  try {
    await SnapRecordDB.purgeOldSessions(7 * 24 * 60 * 60 * 1000);
    const sessions = await SnapRecordDB.getRecordingSessions();
    const now = Date.now();
    const orphans = sessions
      .filter((s) => SnapRecordDB.isOrphan(s, now))
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    if (orphans.length === 0) return;

    recoverySession = orphans[0];
    const capturedMs = Math.max(0, (recoverySession.lastChunkAt || recoverySession.startedAt) - recoverySession.startedAt);
    recoveryDetail.textContent =
      `${new Date(recoverySession.startedAt).toLocaleString()} · ~${Math.round(capturedMs / 1000)}s captured`;
    recoveryBanner.hidden = false;
  } catch (error) {
    console.warn('Recovery check failed:', error);
  }
}

recoverBtn.addEventListener('click', async () => {
  if (!recoverySession) return;
  recoverBtn.disabled = true;
  try {
    const chunks = await SnapRecordDB.getChunks(recoverySession.id);
    if (chunks.length === 0) throw new Error('no recoverable data found');

    const type = recoverySession.mimeType || 'video/webm';
    let blob = new Blob(chunks, { type });
    const durationMs = Math.max(0, (recoverySession.lastChunkAt || Date.now()) - recoverySession.startedAt);
    if (type.startsWith('video/webm')) {
      blob = await SnapRecordWebM.fixBlobDuration(blob, durationMs);
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snaprecord-recovered-${new Date(recoverySession.startedAt).toISOString().replace(/[:.]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);

    await SnapRecordDB.deleteSession(recoverySession.id);
    recoverySession = null;
    recoveryBanner.hidden = true;
  } catch (error) {
    showError(`Recovery failed: ${error.message}`);
    recoverBtn.disabled = false;
  }
});

discardRecoveryBtn.addEventListener('click', async () => {
  if (!recoverySession) return;
  try {
    await SnapRecordDB.deleteSession(recoverySession.id);
  } catch (_e) { /* nothing to keep anyway */ }
  recoverySession = null;
  recoveryBanner.hidden = true;
});
```

Then wire it into popup startup: in the existing `chrome.runtime.sendMessage({ action: 'getRecordingState' }, (response) => {` callback (popup.js:267), the current code only handles `response.isRecording`. Add an `else` branch so the block reads:

```js
  if (response && response.isRecording) {
    // ... existing code unchanged ...
  } else {
    checkForRecoverableRecordings();
  }
```

- [ ] **Step 5: Manual verification**

1. Record a page, close the tab mid-recording (or kill it via Chrome Task Manager). Open the popup → banner appears with timestamp and captured seconds. Click **Recover** → a playable, seekable `.webm` downloads; banner disappears; the session is gone from IndexedDB.
2. Repeat and click **Discard** → session removed, no download.
3. While actively recording, open the popup → NO banner (session not idle).
4. Navigate away mid-recording → browser shows the "Leave site?" prompt.

- [ ] **Step 6: Lint and commit**

Run: `npx eslint popup.js content.js`

```
git add content.js popup.html popup.css popup.js
git commit -m "feat: navigation guard and crash-recovery flow for interrupted recordings"
```

---

### Task 6: Honest format options

**Files:**
- Modify: `popup.html:260-266` (format select)
- Modify: `popup.js` (dynamic MP4 option, saved-value validation, size estimate table)
- Modify: `options.html:63-69` (fileFormat select + description)
- Modify: `options.js` (dynamic MP4 option, load validation)
- Modify: `content.js:1704-1737` (mimeType switch)

**Interfaces:** none produced for later tasks.

- [ ] **Step 1: Remove fake options from `popup.html`**

Delete these two lines from the `#format` select (popup.html:264-265):

```html
            <option value="mp4">MP4 - Most compatible</option>
            <option value="gif">GIF - Animated image</option>
```

- [ ] **Step 2: Add MP4 dynamically in `popup.js`**

Near the top, after the `const errorBanner = ...` declaration, add:

```js
// MP4 recording is only offered when the browser can actually produce it
// (Chrome 126+). Anything else silently produced WebM before — dishonest.
const MP4_RECORDING_SUPPORTED =
  typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4');
if (MP4_RECORDING_SUPPORTED) {
  const mp4Option = document.createElement('option');
  mp4Option.value = 'mp4';
  mp4Option.textContent = 'MP4 - Most compatible';
  format.appendChild(mp4Option);
}
```

In the settings loader (popup.js:134), replace `if (result.format) format.value = result.format;` with:

```js
  if (result.format && Array.from(format.options).some((o) => o.value === result.format)) {
    format.value = result.format;
  }
```

In `updateQualityPreview` (popup.js:248-254), remove the `'gif': 3` line from `formatMultipliers`.

- [ ] **Step 3: Same treatment in options page**

In `options.html`, delete the line `<option value="mp4">MP4 — most compatible</option>` and change the description paragraph to:

```html
          <p class="description">WebM provides excellent quality and compression. MP4 appears here only when your browser supports recording it directly.</p>
```

In `options.js`, after the DOM element declarations (line 10), add:

```js
// Only offer MP4 when the browser can actually record it (Chrome 126+).
if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4')) {
  const mp4Option = document.createElement('option');
  mp4Option.value = 'mp4';
  mp4Option.textContent = 'MP4 — most compatible';
  fileFormat.appendChild(mp4Option);
}
```

And in `loadSettings` (options.js:28), replace `fileFormat.value = result.format;` with:

```js
    fileFormat.value = Array.from(fileFormat.options).some((o) => o.value === result.format)
      ? result.format
      : 'webm-vp9';
```

- [ ] **Step 4: Clean the mimeType switch in `content.js`**

In the `switch (options.format)` (content.js:1704-1737), delete the whole `case 'gif':` block, and replace the `case 'mp4':` block with (fallback kept for stale stored settings):

```js
        case 'mp4':
          if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
            fileExtension = 'mp4';
          } else {
            mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
              ? 'video/webm; codecs=vp9'
              : 'video/webm';
          }
          break;
```

- [ ] **Step 5: Manual verification**

Reload the extension. On current Chrome (126+) the popup format list shows 4 options ending in MP4; recording with MP4 selected produces a real `.mp4`. If a `gif` value was previously saved, the popup falls back to WebM VP9 without errors.

- [ ] **Step 6: Lint and commit**

Run: `npx eslint popup.js options.js content.js`

```
git add popup.html popup.js options.html options.js content.js
git commit -m "fix: only offer honestly supported output formats"
```

---

### Task 7: History previews + retention setting

**Files:**
- Modify: `history.html` (lib script)
- Modify: `history.js` (preview + download-again)
- Modify: `history.css` (preview styles)
- Modify: `options.html` / `options.js` (previewCount setting)

**Interfaces:**
- Consumes: `SnapRecordDB.getFinalizedSessions()`; history entries' `sessionId` (Task 4); `previewCount` sync setting consumed by the bridge (Task 3).

- [ ] **Step 1: Load the DB lib in `history.html`**

Before `<script src="history.js"></script>`, add:

```html
  <script src="lib/recording-db.js"></script>
```

- [ ] **Step 2: Add preview support to `history.js`**

At the top, after the element declarations, add:

```js
// Finalized sessions that still have their video blob cached locally,
// keyed by session id. Loaded once per render.
let previewSessions = new Map();

async function loadPreviewSessions() {
  try {
    const sessions = await SnapRecordDB.getFinalizedSessions();
    previewSessions = new Map(sessions.filter((s) => s.blob).map((s) => [s.id, s]));
  } catch (error) {
    console.warn('Preview sessions unavailable:', error);
    previewSessions = new Map();
  }
}
```

In `loadHistory()`, make the first line `await loadPreviewSessions();`.

In `createHistoryItem`, after the existing `div.querySelector('.delete').addEventListener(...)` line, add:

```js
  const session = recording.sessionId ? previewSessions.get(recording.sessionId) : null;
  if (session) {
    const actions = div.querySelector('.history-actions');

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn-icon';
    downloadBtn.title = 'Download again';
    downloadBtn.setAttribute('aria-label', 'Download this recording again');
    downloadBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    downloadBtn.addEventListener('click', () => {
      const url = URL.createObjectURL(session.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = session.filename || recording.filename || 'recording.webm';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 1000);
    });

    const previewBtn = document.createElement('button');
    previewBtn.className = 'btn-icon';
    previewBtn.title = 'Preview';
    previewBtn.setAttribute('aria-label', 'Preview this recording');
    previewBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

    let previewRow = null;
    let previewUrl = null;
    previewBtn.addEventListener('click', () => {
      if (previewRow) {
        previewRow.remove();
        previewRow = null;
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        return;
      }
      previewUrl = URL.createObjectURL(session.blob);
      previewRow = document.createElement('div');
      previewRow.className = 'preview-row';
      const video = document.createElement('video');
      video.controls = true;
      video.src = previewUrl;
      previewRow.appendChild(video);
      div.appendChild(previewRow);
    });

    actions.prepend(downloadBtn);
    actions.prepend(previewBtn);
  }
```

Note: `createHistoryItem` stays synchronous; it only reads the pre-loaded `previewSessions` map.

- [ ] **Step 3: Style previews in `history.css`**

Append:

```css
/* Inline recording preview */
.history-item {
  flex-wrap: wrap;
}

.preview-row {
  flex-basis: 100%;
  margin-top: 12px;
}

.preview-row video {
  width: 100%;
  border-radius: 8px;
  background: #000;
}
```

(If `.history-item` is not a flex container in the existing CSS, inspect it and adjust so `.preview-row` spans the full row beneath the entry.)

- [ ] **Step 4: Add the retention setting to options**

In `options.html`, inside the "Files" section after the fileFormat setting-group, add:

```html
        <div class="setting-group">
          <label for="previewCount">Keep recent recordings for preview</label>
          <select id="previewCount">
            <option value="0">Don't keep any</option>
            <option value="1">Last 1</option>
            <option value="3">Last 3</option>
            <option value="5">Last 5</option>
          </select>
          <p class="description">Recent recordings are kept on this device (500 MB max) so you can replay or re-download them from History. Everything stays local.</p>
        </div>
```

In `options.js`: add `const previewCount = document.getElementById('previewCount');` to the DOM elements; add `previewCount: '3'` to `defaultSettings`; add `previewCount.value = result.previewCount;` to `loadSettings`; add `previewCount: previewCount.value` to the object in `saveSettings`.

- [ ] **Step 5: Manual verification**

Record two short clips. Open History: both entries show ▶ Preview and re-download buttons; preview plays inline and toggles off; "Download again" saves an identical file. Set "Keep recent recordings" to 1, record another clip → oldest preview disappears from History (entry remains, buttons gone).

- [ ] **Step 6: Lint and commit**

Run: `npx eslint history.js options.js`

```
git add history.html history.js history.css options.html options.js
git commit -m "feat: in-history preview and re-download for recent recordings"
```

---

### Task 8: Privacy branding, permission reduction, version bump

**Files:**
- Modify: `manifest.json` (drop `host_permissions`, version 1.2.0, description)
- Modify: `popup.html` (privacy badge in footer)
- Modify: `popup.css` (badge style)
- Modify: `options.html` (privacy section, About version)
- Modify: `package.json` (version)
- Modify: `README.md` (Privacy section, roadmap/features updates)

**Interfaces:** none.

- [ ] **Step 1: Manifest changes**

In `manifest.json`:
- Change `"version": "1.1.0"` → `"1.2.0"`.
- Change description to: `"Privacy-first screen recorder. 100% local — no account, no uploads, no telemetry. Crash-proof recordings that never lose footage."`
- Delete the whole `host_permissions` block:

```json
  "host_permissions": [
    "<all_urls>"
  ],
```

(`activeTab` is granted on toolbar click AND on `chrome.commands` keyboard shortcuts, which covers both recording entry points. `web_accessible_resources` `matches` does not require host permissions.)

- [ ] **Step 2: Verify recording still works without host permissions**

Reload the extension. Start a recording from the popup on a normal page — works. Start via Alt+Shift+R — works. If keyboard-shortcut injection fails with a permissions error, restore `host_permissions` and note it in the commit message; do NOT leave recording broken.

- [ ] **Step 3: Popup privacy badge**

In `popup.html`, inside the footer `<div class="footer" ...>` (line 332), add as the FIRST child:

```html
      <span class="privacy-badge" title="No account, no uploads, no analytics. Recordings save straight to your device.">
        🔒 100% local
      </span>
```

Append to `popup.css`:

```css
/* Privacy badge */
.privacy-badge {
  font-size: 11px;
  opacity: 0.75;
  cursor: help;
  white-space: nowrap;
}
```

- [ ] **Step 4: Options privacy section + version**

In `options.html`, before the About section, add:

```html
      <section class="settings-section" aria-labelledby="privacy-title">
        <h2 id="privacy-title">Privacy</h2>
        <div class="about-info">
          <p><strong>Your recordings never leave this device.</strong></p>
          <ul class="features-list">
            <li>No account or sign-in — ever</li>
            <li>No uploads: videos download straight to your computer</li>
            <li>No analytics, tracking, or telemetry of any kind</li>
            <li>Minimal permissions: only what recording strictly requires</li>
            <li>Crash-recovery data is stored locally and auto-deleted</li>
          </ul>
        </div>
      </section>
```

Update the About line to `Version 1.2.0`.

- [ ] **Step 5: package.json + README**

Set `"version": "1.2.0"` in `package.json`.

In `README.md`:
- Add to Features: `- 🛟 **Crash-proof recordings** — chunks persist locally as you record; recover footage after a tab crash, navigation, or browser restart` and `- 🔒 **100% private** — no account, no uploads, no telemetry; recordings never leave your device` and `- ⏩ **Seekable videos** — WebM duration is fixed automatically so files scrub correctly in every player`.
- Add a `## 🔒 Privacy` section after Features with the same pledge wording as the options page (this doubles as Web Store listing copy).
- Update the Permissions section to the actual final permission list.
- Update Known Issues: remove/adjust the WebM-seeking caveat.
- Add to the manual Testing Checklist: `- [ ] Kill the tab mid-recording and verify Recover works` and `- [ ] Verify downloaded video is seekable with correct duration`.

- [ ] **Step 6: Commit**

```
git add manifest.json popup.html popup.css options.html package.json README.md
git commit -m "feat: privacy-first branding, minimal permissions, v1.2.0"
```

---

### Task 9: Full verification pass

**Files:** none new.

- [ ] **Step 1: Automated checks**

Run: `npm test` — all suites pass (background tests + 2 new lib suites).
Run: `npx eslint .` — clean.

- [ ] **Step 2: End-to-end manual checklist (load unpacked, Chrome)**

1. Normal flow: record tab 15 s with system audio → downloaded file plays, seeks, shows correct duration.
2. Pause/resume mid-recording → duration excludes paused time (roughly).
3. Crash recovery: kill tab mid-recording → popup shows banner → Recover downloads playable file.
4. Navigation guard: reload page mid-recording → "Leave site?" prompt appears; if user leaves anyway, recovery banner appears next popup open.
5. History: preview + re-download work; retention cap evicts oldest.
6. Formats: only real options listed; MP4 produces `.mp4` on Chrome 126+.
7. CSP fallback: record on a strict-CSP site (e.g. github.com); if the bridge fails there, recording still completes normally (memory-only).
8. Keyboard shortcut Alt+Shift+R starts/stops recording without host permissions.

- [ ] **Step 3: Fix anything found, re-run, commit fixes**

```
git add -A
git commit -m "chore: v1.2 verification fixes"
```

(Only commit if fixes were needed.)
