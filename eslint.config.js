const globals = require('globals');
const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                ...globals.node,
                ...globals.jest,
                chrome: 'readonly',
                CaptureController: 'readonly',
                MediaRecorder: 'readonly',
                SnapRecordDB: 'readonly',
                SnapRecordWebM: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', {
                'argsIgnorePattern': '^_',
                'varsIgnorePattern': '^_',
                'caughtErrorsIgnorePattern': '^_'
            }],
            'no-prototype-builtins': 'off',
            'no-redeclare': 'off' // We have some redeclarations due to top-level script scope issues in analysis, suppressing for now
        }
    }
];
