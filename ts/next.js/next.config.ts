import transpile from 'next-transpile-modules';

let config = {
	reactStrictMode: true,
	swcMinify: true,
	eslint: {
	// Warning: This allows production builds to successfully complete even if
	// your project has ESLint errors.
	ignoreDuringBuilds: true,
},

	tsconfigPath: '../../../tsconfig.json',
	distDir: 'build'
};

export default transpile(['monorepo'])(config)




