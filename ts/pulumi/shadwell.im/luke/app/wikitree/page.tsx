import { Metadata } from 'next/types';

import WikiTreeClient from '#root/ts/pulumi/shadwell.im/luke/app/wikitree/client.js';

export default function Page() {
	return <WikiTreeClient />;
}

export const metadata: Metadata = {
	title: 'WikiTree for Luke Shadwell',
	description: 'React recreation of the classic GeneaWiki Wikidata family tree explorer.',
};
