import { Metadata } from 'next/types/index.js';
import { Suspense } from 'react';

import { Client } from '#root/project/zemn.me/app/experiments/factorio/blueprint/parse/client.js';

export default function () {
	return (
		<Suspense fallback={null}>
			<Client />
		</Suspense>
	);
}

export const metadata: Metadata = {
	title: 'Test factorio blueprint parser',
	description: 'give it a go!',
};
