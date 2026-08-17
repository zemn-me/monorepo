/**
 * This file is automatically copied into every next project root.
 *
 * The generateBuildId component is filled by bazel instrumentation.
 */

interface WebpackConfig {
	resolve?: {
		fallback?: Record<string, false | string>;
	};
}

function webpack(
	config: WebpackConfig,
	{ isServer }: { readonly isServer: boolean }
): WebpackConfig {
	if (!isServer) {
		config.resolve ??= {};
		config.resolve.fallback = {
			...config.resolve.fallback,
			fs: false,
			path: false,
		};
	}

	return config;
}

const config = {
	reactStrictMode: true,
	distDir: 'build',
	typescript: {
		// Bazel already runs tsc checks in dedicated targets.
		ignoreBuildErrors: true,
	},
	output: 'export' as const,
	productionBrowserSourceMaps: false,
	images: {
		unoptimized: true,
	},
	webpack,
};

export default config;
