/* eslint-disable no-undef */
export default {
	haste: {
		enableSymlinks: true,
	},
	reporters: ['default'],
	testMatch: ['**/*_test.js'],
	moduleNameMapper: {
		'examples_jest/(.*)': '<rootDir>/$1',
	},
	testEnvironment: 'jsdom',
};
