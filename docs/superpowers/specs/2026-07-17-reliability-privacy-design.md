# SnapRecord v1.2 Design — "Never loses your footage, never sees your data"

Date: 2026-07-17
Status: Approved

## Goal

Differentiate SnapRecord on the Chrome Web Store with a coherent privacy + reliability
story, targeting the most common complaints against competing recorder extensions:
lost recordings, unseekable WebM files, dishonest format options, and account/upload
requirements.

Scope decision: **incremental hardening** of the existing content-script recording
architecture. No offscreen-document rewrite, no editing features, no cloud anything.

## Current architecture (relevant facts)

- Recording runs in the recorded tab's content script (`content.js`).
  `getDisplayMedia` is requested there; `MediaRecorder` collects 1-second chunks
  into an in-memory array (`content.js` ~line 1763). On stop, chunks become a Blob
  downloaded via a temporary `<a>` element.
- Tab crash, reload, or navigation destroys the recording entirely.
- A content script's IndexedDB belongs to the *page's* origin, so persisting there
  would scatter data across sites and be unreadable from extension pages.
- MP4 and GIF format options silently fall back to WebM.
- History (`history.js`) is metadata-only (filename, date, duration, quality) in
  `chrome.storage.local`; no playback.
- Permissions are already minimal: `activeTab`, `storage`, `scripting`, plus
  `<all_urls>` host permissions.

## Features

### 1. Crash-proof recording via extension-iframe storage bridge

The content script injects an invisible iframe loading `storage-bridge.html`
(an extension page listed in `web_accessible_resources`). Each MediaRecorder chunk
(~2s timeslice) is forwarded to the iframe with `postMessage`, which transfers Blobs
natively (structured clone, no serialization cost). The bridge page writes chunks to
**extension-origin IndexedDB**, tagged with a session ID and sequence number.

- Session metadata (id, started-at, options, tab info, state) is tracked so orphaned
  sessions are detectable.
- On clean stop: the session is finalized; chunks become the recording entry.
- On crash/navigation: the orphaned session stays in IndexedDB. On next popup open,
  the popup asks background/IndexedDB for orphaned sessions and shows a
  **"Recover last recording"** banner. One click rebuilds the WebM from stored chunks
  (running it through the duration patcher) and downloads it. Worst case, the last
  ~2 seconds are lost.
- Cleanup: sessions are deleted after successful download/recovery or dismissal;
  any session older than 7 days is purged on startup.

**Fallback**: if the bridge iframe cannot load (page CSP, sandboxed frames, etc.) or
IndexedDB writes fail (quota), recording continues exactly as today, memory-only.
Reliability features degrade gracefully and never block recording. A single
non-blocking warning is surfaced when persistence is unavailable.

### 2. Navigation guard

While recording, the content script registers:
- `beforeunload` — triggers the browser's native "leave site?" prompt.
- `pagehide` — last-chance `recorder.requestData()` and synchronous-best-effort flush
  of pending chunks to the bridge.

Combined with feature 1, navigating away no longer silently destroys a recording —
the recovery flow catches it.

### 3. WebM duration/seekability fix

MediaRecorder WebM output lacks a Duration element, so players show `Infinity` and
cannot seek. Add a dependency-free EBML post-processor (`webm-duration-fix.js`,
~200 lines): parse the EBML header of the final Blob, inject/patch the
`Info > Duration` element using the measured recording duration, and return a fixed
Blob. Applied on normal stop and on recovery.

Pure function over ArrayBuffers → unit-tested with Jest using small golden WebM
fixtures.

### 4. Honest format options

- Remove the GIF option entirely (returns in a future version as a real feature).
- Show MP4 only when `MediaRecorder.isTypeSupported('video/mp4')` is genuinely true
  (Chrome 126+); the popup queries support and hides/disables the option otherwise.
- Remaining always-available options: WebM VP9 / VP8 / H.264.

### 5. Privacy as a marketed feature

- Popup footer badge: "🔒 100% local — recordings never leave your device", linking
  to a short privacy section on the options page (no account, no upload,
  no telemetry, minimal permissions).
- README gains a "Privacy" section with the same pledge, written for reuse as
  Web Store listing copy.
- Permissions audit: attempt to drop `<all_urls>` host permissions if
  `activeTab` + `scripting` suffice for injecting the content script on user action.
  Verified during implementation; kept only if functionally required.

### 6. History with preview

Because finished recordings now pass through extension IndexedDB, keep the blobs of
the **most recent N recordings** (default 3, configurable in options) subject to a
total size cap (default 500 MB, oldest evicted first). History entries with a stored
blob show a ▶ Preview button (in-page `<video>` player) and "Download again".
Older entries remain metadata-only exactly as today.

## Components

| Component | Responsibility |
|---|---|
| `storage-bridge.html/js` (new) | Extension-origin iframe; receives chunks via postMessage; owns IndexedDB writes |
| `lib/recording-db.js` (new) | IndexedDB schema + helpers (sessions, chunks, finished recordings, eviction) — used by bridge, popup, history |
| `lib/webm-duration-fix.js` (new) | Pure EBML duration patcher |
| `content.js` | Feeds chunks to bridge; navigation guard; fallback logic |
| `popup.js/html` | Recovery banner; format support detection; privacy badge |
| `history.js/html` | Preview player, Download again |
| `options.js/html` | Privacy section; preview-retention settings |
| `manifest.json` | `web_accessible_resources`; possible host-permission reduction |

IndexedDB schema (db `snaprecord`, v1):
- `sessions` store: `{ id, startedAt, state: 'recording'|'finalized', options, mimeType, durationMs }`
- `chunks` store: `{ sessionId+seq (key), blob }`
- Finished recordings are finalized sessions retained per the size cap; history
  metadata in `chrome.storage.local` links to them by session id.

## Error handling

- Bridge unavailable → memory-only mode (today's behavior), one warning.
- IndexedDB quota/write error mid-recording → stop persisting, warn once, keep recording.
- Recovery rebuild failure → offer raw concatenated blob download as last resort.
- Duration patcher failure → fall back to unpatched blob (never block download).

## Testing

- Jest (existing setup): EBML patcher golden-file tests; recording-db session
  lifecycle + eviction logic (with fake-indexeddb or an in-memory shim);
  recovery-detection logic.
- Manual checklist (README): crash-recovery walkthrough (kill tab mid-recording),
  navigation guard, all capture modes, preview playback, format list on
  Chrome with/without MP4 support.

## Out of scope

Offscreen-document re-architecture, trimming/editing, real GIF/MP4 transcoding,
cloud upload, watermarks, scheduled recordings.
