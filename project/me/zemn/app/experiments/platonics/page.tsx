import { PlatonicsClient } from '#root/project/me/zemn/app/experiments/platonics/client.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function Page() {
	return <PlatonicsClient />;
}

export const metadata: Metadata = {
	title: 'Platonic Stress',
	description: 'A dense SVG wireframe field of animated platonic solids.',
};

export const handle = { metadata };
