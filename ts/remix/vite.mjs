import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
// Only explicitly public variables are embedded in browser bundles.
const publicEnvironment = Object.fromEntries(
	[
		'PUBLIC_ZEMN_ME_API_BASE',
		'PUBLIC_ZEMN_TEST_OIDC_ISSUER',
		'PUBLIC_ZEMN_TEST_OIDC_CLIENT_ID',
		'PUBLIC_ZEMN_TEST_OIDC_NAME',
	].map(key => [
		`process.env.${key}`,
		JSON.stringify(process.env[key]) ?? 'undefined',
	])
);

export default defineConfig(({ command }) => ({
	plugins: [
		{
			name: 'bazel-npm-resolution',
			apply: 'build',
			enforce: 'pre',
			async resolveId(source, importer, options) {
				const resolved = await this.resolve(source, importer, {
					...options,
					skipSelf: true,
				});
				if (
					!resolved ||
					resolved.external ||
					!resolved.id.includes('/node_modules/') ||
					resolved.id.startsWith('\0')
				)
					return resolved;
				const [file, query] = resolved.id.split('?');
				if (!existsSync(file)) return resolved;
				return {
					...resolved,
					id: realpathSync(file) + (query ? `?${query}` : ''),
				};
			},
		},
		reactRouter(),
	],
	resolve: {
		// Keep route IDs in the sandbox; npm dependencies still use their real package scopes.
		preserveSymlinks: command === 'build',
		alias: { '#root': workspace },
		// Route modules and shared code can resolve through different Bazel roots.
		// Context providers and consumers must still share one package instance.
		dedupe: ['react', 'react-dom', 'react-router', '@tanstack/react-query'],
	},
	// Concurrent integration services can share Bazel inputs but not optimizer output.
	cacheDir: `.react-router/vite-${process.pid}`,
	// These static routes are browser-safe. Discover their shared dependencies before hydration.
	optimizeDeps: {
		entries: ['app/root.js', 'app/**/page.js', 'app/**/layout.js'],
	},
	define: publicEnvironment,
	server: {
		host: 'localhost',
		fs: { allow: [workspace] },
		// Bazel runfiles contain symlinks back to the workspace, not editable inputs.
		watch: {
			ignored: [
				'**/*.runfiles{,/**}',
				'**/.react-router/**',
				'**/build/**',
			],
		},
	},
	build: { sourcemap: false },
}));
