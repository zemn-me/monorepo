import { Suspense } from 'react';
import ElasticTabStopsClient from '#root/project/me/zemn/app/experiments/elastictabs/client.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function Page() {
	return (
		<Suspense fallback={null}>
			<ElasticTabStopsClient />
		</Suspense>
	);
}

export const metadata: Metadata = {
	title: 'Elastic Tabstops Online',
	description: 'align tabbed columns automatically online!',
};

export const handle = { metadata };
