import { Suspense } from 'react';
import ElasticTabStopsClient from '#root/project/me/zemn/app/tool/elastictabs/client.js';
import { Metadata } from '#root/ts/remix/index.js';

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
