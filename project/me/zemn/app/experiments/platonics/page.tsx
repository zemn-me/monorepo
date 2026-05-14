import { Metadata } from 'next/types';

import { PlatonicsClient } from '#root/project/me/zemn/app/experiments/platonics/client.js';

export default function Page() {
	return <PlatonicsClient />;
}

export const metadata: Metadata = {
	title: 'Platonic Stress',
	description: 'A dense SVG wireframe field of animated platonic solids.',
};
