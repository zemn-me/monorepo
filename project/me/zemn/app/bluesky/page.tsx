import { links } from '#root/project/me/zemn/bio/index.js';
import { Redirect } from '#root/project/me/zemn/components/Redirect/Redirect.js';
import { Metadata } from '#root/ts/remix/index.js';

export default function Page() {
	return <Redirect to={links.get('bluesky')!.href} />;
}

export const metadata: Metadata = {
	description: 'Redirect to my bluesky account',
};
