import { Metadata } from 'next/types';

import { links } from '#root/project/zemn.me/bio/index';
import Redirect from '#root/ts/next.js/component/Redirect/app';

export default function Page() {
	return <Redirect to={links.get('linkedin')!.href} />;
}

export const metadata: Metadata = {
	description: 'Redirect to my linkedin',
};
