import { Links, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { DocumentMeta } from '#root/ts/remix/metadata.js';

export { ErrorBoundary } from '#root/ts/remix/error.js';

import type { ReactNode } from 'react';
import { HeaderTagsAppRouter } from '#root/ts/remix/index.js';
import type { Metadata } from '#root/ts/remix/metadata.js';

import './style.css';

export const metadata: Metadata = {
	title: 'WAXING INCANDESCENT',
};

export function Layout({ children }: { readonly children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<DocumentMeta />
				<Links />
			</head>
			<body>
				<HeaderTagsAppRouter />
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export const handle = { metadata };
