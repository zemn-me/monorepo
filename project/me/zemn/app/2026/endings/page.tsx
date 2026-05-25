import { Metadata } from 'next/types';

import { EndingsClient } from '#root/project/endings/app/client.js';

export default function Page() {
	return <EndingsClient />;
}

export const metadata: Metadata = {
	title: 'Endings',
	description: 'A scroll-driven sunset scene.',
};
