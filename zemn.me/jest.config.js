module.exports = {
	setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
	testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
	transform: {
		'\\.(css|less|scss|sass)$': 'identity-obj-proxy',
		'\\.[jt]sx?$': 'babel-jest',
	},
	moduleDirectories: ['.', 'node_modules'],
	transformIgnorePatterns: ['/node_modules/'],
}
