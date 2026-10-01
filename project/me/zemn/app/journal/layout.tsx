import { Outlet } from 'react-router';
import type { Metadata } from '#root/ts/remix/metadata.js';

export const metadata: Metadata = {
	title: 'Voice journal',
	description: 'A private, transcript-linked voice journal.',
};

export default function Layout() {
	return <Outlet />;
}

export const handle = { metadata };
