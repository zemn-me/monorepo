import { Metadata } from 'next/types';

import { BioWalkClient } from '#root/project/zemn.me/app/experiments/bio_walk/client.js';

export default function Page() {
	return <BioWalkClient />;
}

export const metadata: Metadata = {
	title: 'Bio Walk',
	description: 'Walk around geometry generated from timeline data.',
};
