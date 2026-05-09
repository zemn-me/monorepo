import { Client } from '#root/project/me/zemn/app/experiments/factorio/blueprint/request/client.js';
import { Metadata } from '#root/ts/remix/index.js';

export default function () {
	return <Client />;
}

export const metadata: Metadata = {
	title: 'Test factorio blueprint parser',
	description: 'give it a go!',
};
