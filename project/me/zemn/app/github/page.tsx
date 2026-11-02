import { links } from '#root/project/me/zemn/bio/index.js';
import { Redirect } from '#root/project/me/zemn/components/Redirect/Redirect.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function Page() {
	return <Redirect to={links.get('github')!.href} />;
}

export const metadata: Metadata = {
	description: 'Redirect to my github',
};

export const handle = { metadata };
