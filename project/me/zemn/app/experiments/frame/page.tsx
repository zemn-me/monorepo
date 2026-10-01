import { Suspense } from 'react';
import { FrameClient } from '#root/project/me/zemn/app/experiments/frame/client.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function Page() {
	return (
		<Suspense fallback={null}>
			<FrameClient />
		</Suspense>
	);
}
export const metadata: Metadata = {
	title: 'Framer’s Calculator',
	description: 'Does some of the calculations for using a matteboard cutter.',
};

export const handle = { metadata };
