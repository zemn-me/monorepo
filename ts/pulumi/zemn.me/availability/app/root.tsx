import { Links, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { DocumentMeta } from '#root/ts/remix/metadata.js';

export { ErrorBoundary } from '#root/ts/remix/error.js';

import { ReactNode } from 'react';
import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTagsAppRouter,
} from '#root/ts/remix/index.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export interface Props {
	readonly children?: ReactNode;
}

const cspPolicy: CspPolicy = {
	...DefaultContentSecurityPolicy,
	'object-src': new Set(["'none'"]),
};

export function Layout({ children }: Props) {
	return (
		<html>
			<head>
				<DocumentMeta />
				<Links />
				<HeaderTagsAppRouter cspPolicy={cspPolicy} />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export const metadata: Metadata = {
	title: 'Thomas’ Availability',
	authors: [{ name: 'zemnmez' }],
	alternates: {
		canonical: 'https://zemn.me/availability',
	},
	robots: {
		index: false,
		follow: false,
	},
	twitter: {
		site: '@zemnmez',
		creator: '@zemnnmez',
	},
};

export const viewport = {
	width: 'device-width',
	initialScale: 1,
};

export default function App() {
	return <Outlet />;
}

export const handle = { metadata, viewport };
