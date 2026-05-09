import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
	index('./home.tsx'),
	route('admin', './admin.tsx'),
	route('admin/users', './admin-users.tsx'),
	route('article', './article.tsx'),
	route('article/2014/csp', './article-2014-csp.tsx'),
	route('article/2019/cors', './article-2019-cors.tsx'),
	route('article/2024/clean', './article-2024-clean.tsx'),
	route('article/2024/missing', './article-2024-missing.tsx'),
	route('bluesky', './bluesky.tsx'),
	route('callback', './callback.tsx'),
	route('experiments', './experiments.tsx'),
	route('experiments/arena', './experiments-arena.tsx'),
	route('experiments/article', './experiments-article.tsx'),
	route('experiments/cultist', './experiments-cultist.tsx'),
	route('experiments/cv', './experiments-cv.tsx'),
	route('experiments/emoji/flag', './experiments-emoji-flag.tsx'),
	route('experiments/factorio', './experiments-factorio.tsx'),
	route(
		'experiments/factorio/blueprint',
		'./experiments-factorio-blueprint.tsx'
	),
	route(
		'experiments/factorio/blueprint/book',
		'./experiments-factorio-blueprint-book.tsx'
	),
	route(
		'experiments/factorio/blueprint/parse',
		'./experiments-factorio-blueprint-parse.tsx'
	),
	route(
		'experiments/factorio/blueprint/request',
		'./experiments-factorio-blueprint-request.tsx'
	),
	route(
		'experiments/factorio/blueprint/wall',
		'./experiments-factorio-blueprint-wall.tsx'
	),
	route('experiments/frame', './experiments-frame.tsx'),
	route(
		'experiments/geometry_of_music',
		'./experiments-geometry-of-music.tsx'
	),
	route('experiments/rays', './experiments-rays.tsx'),
	route('experiments/toc', './experiments-toc.tsx'),
	route('github', './github.tsx'),
	route('grievanceportal', './grievanceportal.tsx'),
	route('healthcheck/bad', './healthcheck-bad.tsx'),
	route('healthz', './healthz.tsx'),
	route('key', './key.tsx'),
	route('linkedin', './linkedin.tsx'),
	route('src', './src-index.tsx'),
	route('src/*', './src-splat.tsx'),
	route('tool/elastictabs', './tool-elastictabs.tsx'),
	route('twitter', './twitter.tsx'),
] satisfies RouteConfig;
