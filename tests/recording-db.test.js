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
