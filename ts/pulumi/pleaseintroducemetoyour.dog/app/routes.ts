import type { RouteConfig } from '@react-router/dev/routes';

export default [
	{
		file: 'page.js',
		index: true,
	},
	{
		file: 'daily/page.js',
		path: 'daily',
	},
	{
		path: '*',
		file: 'not-found.js',
	},
] satisfies RouteConfig;
