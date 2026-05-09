import { Client } from '#root/project/me/zemn/app/experiments/factorio/blueprint/wall/client.js';
import { Metadata } from '#root/ts/remix/index.js';

export default function () {
	return <Client />;
}

export const metadata: Metadata = {
	title: 'Factorio experiment -- surround a blueprint with a wall',
	description: 'give it a go?',
};
