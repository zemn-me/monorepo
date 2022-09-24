/* eslint-disable no-undef */
export default {
	testEnvironment: 'node',
	haste: {
		enableSymlinks: true,
	},
	reporters: ['default'],
	testMatch: ['**/*_test.js'],
	moduleNameMapper: {
		'examples_jest/(.*)': '<rootDir>/$1',
	},
	// https://github.com/facebook/jest/issues/12889#issuecomment-1193908448
	moduleDirectories: ['node_modules', '<rootDir>'],
	rootDir: '../..',
};
