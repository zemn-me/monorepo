import { Metadata } from 'next/types';

import { ArenaClient } from '#root/project/zemn.me/app/experiments/arena/client.js';

export default function Page() {
	return <ArenaClient />;
}

export const metadata: Metadata = {
	title: 'SVG Arena',
	description: 'A pointer-lock SVG arena using the site math utilities.',
};
