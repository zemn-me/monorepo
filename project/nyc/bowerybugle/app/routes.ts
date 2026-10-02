import type { RouteConfig } from '@react-router/dev/routes';
export default [
	{ index: true, file: 'page.js' },
	{ path: 'manage', file: 'manage.js' },
	{ path: '*', file: 'not-found.js' },
] satisfies RouteConfig;
