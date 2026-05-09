import type { Config } from '@react-router/dev/config';

const sourceRedirectPaths = [
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
];

export default {
	appDirectory: 'router',
	async prerender({ getStaticPaths }) {
		return [...getStaticPaths(), ...sourceRedirectPaths];
	},
	ssr: false,
} satisfies Config;
