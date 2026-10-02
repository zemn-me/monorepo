import { Suspense } from 'react';
import { Outlet } from 'react-router';
import type { Metadata } from '#root/ts/remix/metadata.js';

export const metadata: Metadata = {
	title: 'Connect your voice journal',
	referrer: 'no-referrer',
	robots: { index: false, follow: false },
};

export default function Layout() {
	return (
		<Suspense fallback={<p role="status">Loading connection request…</p>}>
			<Outlet />
		</Suspense>
	);
}

export const handle = { metadata };
