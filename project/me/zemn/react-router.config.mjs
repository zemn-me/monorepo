export default {
	ssr: true,
	buildDirectory: '.react-router-build',
	routeDiscovery: { mode: 'initial' },
	prerender: ({ getStaticPaths }) => [
		// Authenticated and backend-driven pages must run at request time.
		...getStaticPaths().filter(
			path => !/^\/(journal|admin|callback|key|healthz)(\/|$)/.test(path)
		),
		...[
			'/src',
			'/src/issues',
			'/src/pulls',
			'/src/discussions',
			'/src/actions',
			'/src/projects',
			'/src/wiki',
			'/src/security',
			'/src/insights',
			'/src/commits',
		],
	],
};
