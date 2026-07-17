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
