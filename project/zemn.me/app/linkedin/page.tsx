import { Metadata } from 'next/types';

import { links } from '#root/project/zemn.me/bio/index.js';
import Redirect from '#root/ts/next.js/component/Redirect/app.js';

export default function Page() {
	return <Redirect to={links.get('linkedin')!.href} />;
}

export const metadata: Metadata = {
	description: 'Redirect to my linkedin',
};
