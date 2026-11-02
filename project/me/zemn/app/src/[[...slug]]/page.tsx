import { Redirect } from '#root/project/me/zemn/components/Redirect/Redirect.js';
import { githubRepoUrl } from '#root/ts/constants/constants.js';
import { isDefined } from '#root/ts/guard.js';
import { Metadata } from '#root/ts/remix/metadata.js';

interface PageProps {
	readonly params: { '*'?: string };
}

export default function Page({ params }: PageProps) {
	const u = new URL(githubRepoUrl);
	u.pathname = [u.pathname, params['*']].filter(isDefined).join('/');
	return <Redirect to={u.toString()} />;
}

export const metadata: Metadata = {
	description: 'Redirect to the source code.',
};

export const handle = { metadata };
