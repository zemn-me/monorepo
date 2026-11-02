import { Client } from '#root/project/me/zemn/app/experiments/factorio/blueprint/request/client.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function () {
	return <Client />;
}

export const metadata: Metadata = {
	title: 'Test factorio blueprint parser',
	description: 'give it a go!',
};

export const handle = { metadata };
