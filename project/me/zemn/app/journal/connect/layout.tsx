import type { Metadata } from 'next/types';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
	title: 'Connect your voice journal',
	referrer: 'no-referrer',
	robots: { index: false, follow: false },
};

export default function Layout({ children }: { readonly children: ReactNode }) {
	return children;
}
