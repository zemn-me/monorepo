import { Metadata } from 'next/types';
import { githubRepoUrl } from 'ts/constants/constants';
import Redirect from 'ts/next.js/component/Redirect/app';

export default function Page({
	params,
}: {
	readonly params: { slug: string[] };
}) {
	const u = new URL(githubRepoUrl);
	u.pathname += params.slug.join('/');
	u.hash = document.location.hash;
	return <Redirect to={u} />;
}

export const metadata: Metadata = {
	description: 'Redirect to the source code.',
};
