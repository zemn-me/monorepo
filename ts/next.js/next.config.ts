/**
 * This file is automatically copied into every next project root.
 *
 * The generateBuildId component is filled by bazel instrumentation.
 */

export const reactStrictMode = true;
export const swcMinify = true;
export const distDir = 'build';

export const typescript = {
	// Bazel already runs tsc checks in dedicated targets.
	ignoreBuildErrors: true,
};

export const output = 'export';

export const productionBrowserSourceMaps = false;

export const future = { webpack5: true };

export const images = {
	unoptimized: true,
};
