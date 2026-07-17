// Regression test for the Stop-button reliability fix (content.js).
//
// Bug: clicking Stop while the pre-recording countdown was running did
// nothing under the hood — the countdown kept running and recording
// started anyway a few seconds later, leaving the browser's screen-share
// indicator active. Stop must cancel any in-flight start attempt and stop
// the live stream immediately, at every stage.
const { test, expect } = require('./support/extension-fixtures');

const START_OPTIONS = {
  captureType: 'screen',
  audioEnabled: false,
  micEnabled: false,
  cameraEnabled: false,
  quality: '720',
  frameRate: '30',
  format: 'webm-vp9',
  annotationsEnabled: false
};

test('Stop clicked mid-countdown cancels recording and ends the screen share', async ({
  recordablePage,
  background
}) => {
  const tabId = await background.activeTabId();

  const startResult = await background.call(
    (opts) => self.startRecording(opts),
    { ...START_OPTIONS, countdownSeconds: 3 }
  );
  expect(startResult.success).toBe(true);

  await recordablePage.waitForTimeout(900); // land inside the 3s countdown

  const midState = await background.call(() => self.getState());
  expect(midState.isRecording).toBe(true);
  expect(midState.recordingStartTime).toBe(0); // still counting down, never actually started

  const stopResult = await background.call(() => self.stopRecording());
  expect(stopResult.success).toBe(true);

  await recordablePage.waitForTimeout(500); // let the abort + track.stop() run

  const stateRightAfterStop = await background.getContentScriptState(tabId);
  expect(stateRightAfterStop.streamEverCreated).toBe(true);
  expect(stateRightAfterStop.streamTracks).toEqual([
    expect.objectContaining({ kind: 'video', readyState: 'ended' })
  ]);

  // Wait past the original 3s countdown — this is the assertion that
  // actually catches the bug: on the old code, recording silently starts
  // here even though Stop was already clicked.
  await recordablePage.waitForTimeout(3000);

  const finalState = await background.call(() => self.getState());
  expect(finalState.isRecording).toBe(false);

  const finalContentState = await background.getContentScriptState(tabId);
  expect(finalContentState.recorderIsNull).toBe(true);
});

test('Stop after recording has actually started still stops normally', async ({
  recordablePage,
  background
}) => {
  const tabId = await background.activeTabId();

  const startResult = await background.call(
    (opts) => self.startRecording(opts),
    { ...START_OPTIONS, countdownSeconds: 0 }
  );
  expect(startResult.success).toBe(true);

  // No countdown, so recording starts almost immediately.
  await expect.poll(
    async () => (await background.call(() => self.getState())).recordingStartTime > 0,
    { timeout: 5000 }
  ).toBe(true);

  await recordablePage.waitForTimeout(1000); // capture a little real footage

  const stopResult = await background.call(() => self.stopRecording());
  expect(stopResult.success).toBe(true);

  await recordablePage.waitForTimeout(500); // let MediaRecorder's onstop run

  const finalContentState = await background.getContentScriptState(tabId);
  expect(finalContentState.streamTracks).toEqual([
    expect.objectContaining({ kind: 'video', readyState: 'ended' })
  ]);
  expect(finalContentState.recorderIsNull).toBe(true);

  const finalState = await background.call(() => self.getState());
  expect(finalState.isRecording).toBe(false);
});
