export const reactStrictMode = true;
export const swcMinify = true;

export const eslint = {
	// Warning: This allows production builds to successfully complete even if
	// your project has ESLint errors.
	ignoreDuringBuilds: true,
};

export const typescript = {
	tsconfigPath: '../../../tsconfig.json',
};

export const distDir = 'build';
