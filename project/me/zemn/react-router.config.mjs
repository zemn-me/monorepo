export default {
	ssr: false,
	buildDirectory: '.react-router-build',
	routeDiscovery: { mode: 'initial' },
	prerender: ({ getStaticPaths }) => [
		...getStaticPaths(),
		...[
			'/404',
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
