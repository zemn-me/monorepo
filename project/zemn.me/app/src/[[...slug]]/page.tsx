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
