global.chrome = {
    runtime: {
        onInstalled: { addListener: jest.fn() },
        onStartup: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() },
        sendMessage: jest.fn(),
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
        },
        sync: {
            get: jest.fn(),
            set: jest.fn(),
        }
    },
    tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
        get: jest.fn(),
        onRemoved: { addListener: jest.fn() },
    },
    scripting: {
        executeScript: jest.fn(),
    },
    action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn(),
    },
    commands: {
        onCommand: { addListener: jest.fn() }
    }
};

global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
};
