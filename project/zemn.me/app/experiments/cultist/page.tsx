import { Metadata } from 'next/types';

import { loadCoreContent } from '#root/project/cultist/content_node.js';
import Main from '#root/project/zemn.me/app/experiments/cultist/client.js';

export default async function Page() {
	const core = await loadCoreContent();

	return <Main core={core} />;
}

export const metadata: Metadata = {
	title: 'Cultist simulator experiment',
};
