export default {
	ssr: false,
	buildDirectory: '.react-router-build',
	routeDiscovery: { mode: 'initial' },
	prerender: ({ getStaticPaths }) => [...getStaticPaths(), ...['/404']],
};
