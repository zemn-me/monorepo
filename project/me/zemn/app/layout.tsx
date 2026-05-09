import './base.css';

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode } from 'react';
import { Links, Meta, Scripts } from 'react-router';

import { AnalyticsPageBeacon } from '#root/project/me/zemn/app/analytics.js';
import { Providers } from '#root/project/me/zemn/app/providers.js';
import { Bio } from '#root/project/me/zemn/bio/index.js';
import Glade from '#root/project/me/zemn/components/Glade/glade.js';
import { ZEMN_ME_API_BASE } from '#root/project/me/zemn/constants/constants.js';
import { text } from '#root/ts/react/lang/index.js';
import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTags,
	Metadata,
} from '#root/ts/remix/index.js';

export interface Props {
	readonly children?: ReactNode;
}

const csp: CspPolicy = {
	...DefaultContentSecurityPolicy,
	'connect-src': new Set([
		...DefaultContentSecurityPolicy['connect-src']!,
		'https://accounts.google.com',
		'https://people.googleapis.com',
		'http://localhost:*' as 'https://localhost',
		ZEMN_ME_API_BASE as 'https://api.zemn.me',
		'https://www.googleapis.com', // dub-dub-dub?? what year is it?
	]),
	'img-src': new Set([
		...DefaultContentSecurityPolicy['img-src']!,
		'https://*.googleusercontent.com',
	]),
};

export function RootLayout({ children }: Props) {
	return (
		<html>
			<head>
				<Meta />
				<Links />
				<link href="https://fonts.googleapis.com" rel="preconnect" />
				<link
					crossOrigin="anonymous"
					href="https://fonts.gstatic.com"
					rel="preconnect"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap"
					rel="stylesheet"
				/>
				<link href="/icon.svg" rel="icon" type="image/svg+xml" />
				<link
					href="/icon.svg"
					rel="apple-touch-icon"
					type="image/svg+xml"
				/>
				<HeaderTags cspPolicy={csp} />
			</head>
			<body>
				<Providers>
					<>
						<ReactQueryDevtools initialIsOpen={false} />
						<AnalyticsPageBeacon />
						<Glade>{children}</Glade>
					</>
				</Providers>
				<Scripts />
			</body>
		</html>
	);
}

export default RootLayout;

export const metadata: Metadata = {
	themeColor: [
		{ media: '(prefers-color-scheme: dark)', color: '#010' },
		{ media: '(prefers-color-scheme: light)', color: '#fff' },
	],
	authors: [{ name: text(Bio.who.fullName), url: 'https://zemn.me' }],
	metadataBase: new URL('https://zemn.me'),
	twitter: {
		creator: '@zemnmez',
	},
	// fairly sure I do these manually.
	// not sure about date and address -- are these
	// the <datetime> and <addr> tags?
	formatDetection: {
		telephone: false,
		email: false,
		url: false,
	},
	title: {
		default: 'zemn.me',
		template: '%s ← zemn.me',
	},
	alternates: {
		canonical: './',
	},
};
