import type { Metadata } from 'next/types';
import { type ReactNode, Suspense } from 'react';

export const metadata: Metadata = {
	title: 'Connect your voice journal',
	referrer: 'no-referrer',
	robots: { index: false, follow: false },
};

export default function Layout({ children }: { readonly children: ReactNode }) {
	return (
		<Suspense fallback={<p role="status">Loading connection request…</p>}>
			{children}
		</Suspense>
	);
}
