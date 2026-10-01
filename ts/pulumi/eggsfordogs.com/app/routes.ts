import type { RouteConfig } from '@react-router/dev/routes';

export default [
	{
		file: 'page.js',
		index: true,
	},
	{
		path: '*',
		file: 'not-found.js',
	},
] satisfies RouteConfig;
