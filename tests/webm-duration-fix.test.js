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
