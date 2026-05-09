import { Suspense } from 'react';
import { Client } from '#root/project/me/zemn/app/experiments/factorio/blueprint/parse/client.js';
import { Metadata } from '#root/ts/remix/index.js';

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
