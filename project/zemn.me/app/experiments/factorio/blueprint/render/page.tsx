import { Metadata } from 'next/types/index.js';

import { Client } from '#root/project/zemn.me/app/experiments/factorio/blueprint/render/client.js';

export default function () {
	return <Client />;
}

export const metadata: Metadata = {
	title: 'Factorio experiment -- blueprint renderer',
};
