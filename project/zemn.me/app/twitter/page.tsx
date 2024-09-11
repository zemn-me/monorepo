import { Metadata } from 'next/types';

import { links } from '#root/project/zemn.me/bio/index.js';
import { Redirect } from '#root/project/zemn.me/components/Redirect/Redirect.js';

export default function Page() {
	return <Redirect to={links.get('twitter')!.href} />;
}

export const metadata: Metadata = {
	description: 'Redirect to my twitter',
};
