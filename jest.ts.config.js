/* eslint-disable no-undef */
module.exports = {
	testEnvironment: 'node',
	haste: {
		enableSymlinks: true,
	},
	reporters: ['default'],
	testMatch: ['**/*_test.js'],
	moduleNameMapper: {
		'examples_jest/(.*)': '<rootDir>/$1',
	},
};
