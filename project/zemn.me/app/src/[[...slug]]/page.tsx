import { Metadata } from 'next/types';

import { githubRepoUrl } from '#root/ts/constants/constants.js';
import { isDefined } from '#root/ts/guard.js';
import Redirect from '#root/ts/next.js/component/Redirect/app.js';

interface PageProps {
	readonly params: { slug?: string[] };
}

export default function Page({ params }: PageProps) {
	const u = new URL(githubRepoUrl);
	u.pathname = [u.pathname, params.slug?.join('/')]
		.filter(isDefined)
		.join('/');
	return <Redirect to={u.toString()} />;
}

export const metadata: Metadata = {
	description: 'Redirect to the source code.',
};

/**
 * Because I'm using static export, if I don't have exact route
 * names a 404 happens.
 *
 * `undefined` doesn't seem to generate an index.html?
 * ah well, good enough.
 */
export async function generateStaticParams(): Promise<PageProps['params'][]> {
	const githubSubpaths = [
		undefined,
		['issues'],
		['pulls'],
		['discussions'],
		['actions'],
		['projects'],
		['wiki'],
		['security'],
		['insights'],
		['commits'],
	];

	return githubSubpaths.map(v => (v ? { slug: v } : {}));
}
