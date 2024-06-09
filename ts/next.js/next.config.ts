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

export const output = 'export';


export const generateBuildId = async () => { /*REPLACE*/ throw new Error() /*REPLACE*/ };

export const productionBrowserSourceMaps = true;

export const future = { webpack5: true };

type StopGapConfigT = {
	module: { rules: { test: RegExp; use: string[]; enforce: string }[] };
};

export const images = {
	unoptimized: true
};

export const webpack = (config: StopGapConfigT) => {
	config.module.rules.push({
		test: /\.js$/,
		use: ['source-map-loader'],
		enforce: 'pre',
	});
	return config;
};
