/**
 * This file is automatically copied into every next project root.
 *
 * The generateBuildId component is filled by bazel instrumentation.
 */

export const reactStrictMode = true;
export const swcMinify = true;

export const eslint = {
	// Warning: This allows production builds to successfully complete even if
	// your project has ESLint errors.
	ignoreDuringBuilds: true,
};

export const distDir = 'build';

// eslint-disable-next-line
export const generateBuildId = async () => { /*REPLACE*/ throw new Error() /*REPLACE*/ };