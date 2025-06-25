 
export default {
        testEnvironment: 'jsdom',
        haste: {
                enableSymlinks: true,
        },
        reporters: ['default'],
        testMatch: ['**/*_test.js'],
        moduleNameMapper: {
                'examples_jest/(.*)': '<rootDir>/$1',
                '\\.(css)$': '<rootDir>/ts/jest/cssStub.js',
        },
        setupFilesAfterEnv: ['<rootDir>/ts/jest/jest.setup.js'],
        // https://github.com/facebook/jest/issues/12889#issuecomment-1193908448
        moduleDirectories: ['node_modules', '<rootDir>'],
        rootDir: '../..',
};
