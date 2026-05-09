import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
	index('./page.tsx'),
	route('daily', './daily.tsx'),
] satisfies RouteConfig;
