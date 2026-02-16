import { Metadata } from 'next/types';

import { links } from '#root/project/me/zemn/bio/index.js';
import { Redirect } from '#root/project/me/zemn/components/Redirect/Redirect.js';

export default function Page() {
	return <Redirect to={links.get('github')!.href} />;
}

export const metadata: Metadata = {
	description: 'Redirect to my github',
};
