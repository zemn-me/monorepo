import { Metadata } from 'next/types';

import { Framer } from '#root/project/zemn.me/app/experiments/framer/framer';

export default function Page() {
	return <Framer />;
}

export const metadata: Metadata = {
	title: 'Framer',
	description: 'Helps choose frames and mattes for your wall.',
};
