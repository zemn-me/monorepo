import { EndingsClient } from '#root/project/endings/app/client.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function Page() {
	return <EndingsClient />;
}

export const metadata: Metadata = {
	title: 'Endings',
	description: 'A scroll-driven sunset scene.',
};

export const handle = { metadata };
