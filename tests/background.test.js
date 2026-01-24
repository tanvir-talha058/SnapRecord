const background = require('../background.js');

describe('Background Script State Management', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset global chrome mocks if needed
        global.chrome.storage.local.get.mockResolvedValue({});
        global.chrome.storage.local.set.mockResolvedValue();
    });

    test('getState returns initial state when storage is empty', async () => {
        const state = await background.getState();
        expect(state).toEqual(background.initialState);
        expect(global.chrome.storage.local.get).toHaveBeenCalledWith('recordingState');
    });

    test('getState returns stored state', async () => {
        const mockState = { isRecording: true };
        global.chrome.storage.local.get.mockResolvedValue({ recordingState: mockState });

        const state = await background.getState();
        expect(state).toEqual(mockState);
    });

    test('initializeState sets initial state if storage is empty', async () => {
        global.chrome.storage.local.get.mockResolvedValue({});

        await background.initializeState();

        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            recordingState: background.initialState
        });
    });

    test('initializeState cleans up orphan state if tab is missing', async () => {
        const orphanState = { isRecording: true, recordingTabId: 123 };
        global.chrome.storage.local.get.mockResolvedValue({ recordingState: orphanState });
        global.chrome.tabs.get.mockRejectedValue(new Error('Tab not found'));

        await background.initializeState();

        expect(global.chrome.tabs.get).toHaveBeenCalledWith(123);
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            recordingState: background.initialState
        });
    });

    test('updateState merges updates and saves to storage', async () => {
        const currentState = { ...background.initialState, isRecording: false };
        global.chrome.storage.local.get.mockResolvedValue({ recordingState: currentState });

        const updates = { isRecording: true, recordingTabId: 456 };
        const newState = await background.updateState(updates);

        expect(newState).toEqual({ ...currentState, ...updates });
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            recordingState: newState
        });
    });

    test('startRecording should fail if already recording', async () => {
        global.chrome.storage.local.get.mockResolvedValue({
            recordingState: { ...background.initialState, isRecording: true }
        });

        const result = await background.startRecording({});
        expect(result.success).toBe(false);
        expect(result.error).toBe('Already recording');
    });
});
