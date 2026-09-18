import type { Metadata } from 'next/types';

import type { ReactNode } from 'react';

export const metadata: Metadata = {
	title: 'Voice journal',
	description: 'A private, transcript-linked voice journal.',
};

export default function Layout({ children }: { readonly children: ReactNode }) {
	return children;
}
