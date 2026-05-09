import './base.css';

import { ReactNode } from 'react';
import { Links, Meta, Scripts } from 'react-router';

import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTags,
	Metadata,
} from '#root/ts/remix/index.js';

export interface Props {
	readonly children?: ReactNode;
}

const cspPolicy: CspPolicy = {
	...DefaultContentSecurityPolicy,
	'object-src': new Set(['https://calendar.google.com']),
};

export function RootLayout({ children }: Props) {
	return (
		<html>
			<head>
				<Meta />
				<Links />
				<HeaderTags cspPolicy={cspPolicy} />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

export default RootLayout;

export const metadata: Metadata = {
	title: 'Thomas’ Availability',
	authors: [{ name: 'zemnmez' }],
	twitter: {
		site: '@zemnmez',
		creator: '@zemnnmez',
	},
};

export const viewport = {
	width: 'device-width',
	initialScale: 1,
};
