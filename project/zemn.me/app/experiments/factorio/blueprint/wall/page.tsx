import { Metadata } from 'next/types/index.js';

import { Client } from '#root/project/zemn.me/app/experiments/factorio/blueprint/wall/client.js';

export default function () {
	return <Client />;
}

export const metadata: Metadata = {
	title: 'Factorio experiment -- surround a blueprint with a wall',
	description: 'give it a go?',
};
