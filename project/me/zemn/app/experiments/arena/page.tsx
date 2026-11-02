import { ArenaClient } from '#root/project/me/zemn/app/experiments/arena/client.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function Page() {
	return <ArenaClient />;
}

export const metadata: Metadata = {
	title: 'SVG Arena',
	description: 'A pointer-lock SVG arena using the site math utilities.',
};

export const handle = { metadata };
