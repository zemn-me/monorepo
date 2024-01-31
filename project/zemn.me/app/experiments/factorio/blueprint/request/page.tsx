import { Metadata } from 'next/types/index.js';

import { Client } from '#root/project/zemn.me/app/experiments/factorio/blueprint/request/client.js';

export default function () {
	return <Client />;
}

export const metadata: Metadata = {
	title: 'Test factorio blueprint parser',
	description: 'give it a go!',
};
