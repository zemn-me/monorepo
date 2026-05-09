import { ArenaClient } from '#root/project/me/zemn/app/experiments/arena/client.js';
import { Metadata } from '#root/ts/remix/index.js';

export default function Page() {
	return <ArenaClient />;
}

export const metadata: Metadata = {
	title: 'SVG Arena',
	description: 'A pointer-lock SVG arena using the site math utilities.',
};
