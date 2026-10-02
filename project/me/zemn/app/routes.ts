import type { RouteConfig } from '@react-router/dev/routes';

export default [
	{
		file: 'page.js',
		index: true,
	},
	{
		path: '2026/endings',
		file: '2026/endings/layout.js',
		children: [
			{
				file: '2026/endings/page.js',
				index: true,
			},
		],
	},
	{
		file: 'about/page.js',
		path: 'about',
	},
	{
		file: 'admin/page.js',
		path: 'admin',
	},
	{
		file: 'admin/analytics/page.js',
		path: 'admin/analytics',
	},
	{
		file: 'admin/users/page.js',
		path: 'admin/users',
	},
	{
		file: 'article/page.js',
		path: 'article',
	},
	{
		file: 'article/2014/csp/page.js',
		path: 'article/2014/csp',
	},
	{
		file: 'article/2019/cors/page.js',
		path: 'article/2019/cors',
	},
	{
		file: 'article/2020/icloud/page.js',
		path: 'article/2020/icloud',
	},
	{
		file: 'article/2024/clean/page.js',
		path: 'article/2024/clean',
	},
	{
		file: 'article/2024/missing/page.js',
		path: 'article/2024/missing',
	},
	{
		file: 'article/2026/kasimir/page.js',
		path: 'article/2026/kasimir',
	},
	{
		file: 'availability/page.js',
		path: 'availability',
	},
	{
		file: 'bluesky/page.js',
		path: 'bluesky',
	},
	{
		file: 'callback/page.js',
		path: 'callback',
	},
	{
		file: 'cv/page.js',
		path: 'cv',
	},
	{
		file: 'experiments/page.js',
		path: 'experiments',
	},
	{
		file: 'experiments/arena/page.js',
		path: 'experiments/arena',
	},
	{
		file: 'experiments/article/page.js',
		path: 'experiments/article',
	},
	{
		file: 'experiments/cultist/page.js',
		path: 'experiments/cultist',
	},
	{
		file: 'experiments/cv/page.js',
		path: 'experiments/cv',
	},
	{
		file: 'experiments/elastictabs/page.js',
		path: 'experiments/elastictabs',
	},
	{
		file: 'experiments/emoji/flag/page.js',
		path: 'experiments/emoji/flag',
	},
	{
		file: 'experiments/factorio/page.js',
		path: 'experiments/factorio',
	},
	{
		file: 'experiments/factorio/blueprint/page.js',
		path: 'experiments/factorio/blueprint',
	},
	{
		file: 'experiments/factorio/blueprint/book/page.js',
		path: 'experiments/factorio/blueprint/book',
	},
	{
		file: 'experiments/factorio/blueprint/parse/page.js',
		path: 'experiments/factorio/blueprint/parse',
	},
	{
		file: 'experiments/factorio/blueprint/request/page.js',
		path: 'experiments/factorio/blueprint/request',
	},
	{
		file: 'experiments/factorio/blueprint/wall/page.js',
		path: 'experiments/factorio/blueprint/wall',
	},
	{
		file: 'experiments/frame/page.js',
		path: 'experiments/frame',
	},
	{
		file: 'experiments/geometry_of_music/page.js',
		path: 'experiments/geometry_of_music',
	},
	{
		file: 'experiments/pitch_training/page.js',
		path: 'experiments/pitch_training',
	},
	{
		file: 'experiments/platonics/page.js',
		path: 'experiments/platonics',
	},
	{
		file: 'experiments/rays/page.js',
		path: 'experiments/rays',
	},
	{
		file: 'experiments/toc/page.js',
		path: 'experiments/toc',
	},
	{
		file: 'github/page.js',
		path: 'github',
	},
	{
		file: 'grievanceportal/page.js',
		path: 'grievanceportal',
	},
	{
		file: 'healthcheck/bad/page.js',
		path: 'healthcheck/bad',
	},
	{
		file: 'healthz/page.js',
		path: 'healthz',
	},
	{
		path: 'journal',
		file: 'journal/layout.js',
		children: [
			{
				file: 'journal/page.js',
				index: true,
			},
			{
				path: 'connect',
				file: 'journal/connect/layout.js',
				children: [
					{
						file: 'journal/connect/page.js',
						index: true,
					},
				],
			},
			{
				file: 'journal/day/page.js',
				path: 'day',
			},
			{
				file: 'journal/month/page.js',
				path: 'month',
			},
			{
				file: 'journal/week/page.js',
				path: 'week',
			},
			{
				file: 'journal/year/page.js',
				path: 'year',
			},
		],
	},
	{
		file: 'key/page.js',
		path: 'key',
	},
	{
		file: 'linkedin/page.js',
		path: 'linkedin',
	},
	{
		file: 'minecraft/page.js',
		path: 'minecraft',
	},
	{
		file: 'src/[[...slug]]/page.js',
		path: 'src/*',
	},
	{
		file: 'tool/elastictabs/page.js',
		path: 'tool/elastictabs',
	},
	{
		file: 'twitter/page.js',
		path: 'twitter',
	},
	{
		path: '*',
		file: 'not-found.js',
	},
] satisfies RouteConfig;
