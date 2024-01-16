import { Metadata } from 'next/types';
import { githubRepoUrl } from 'ts/constants/constants';
import { isDefined } from 'ts/guard';
import Redirect from 'ts/next.js/component/Redirect/app';

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
