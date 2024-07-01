import { Metadata } from 'next/types/index';

import { Client } from '#root/project/zemn.me/app/experiments/factorio/blueprint/wall/client';

export default function () {
	return <Client />;
}

export const metadata: Metadata = {
	title: 'Factorio experiment -- surround a blueprint with a wall',
	description: 'give it a go?',
};
