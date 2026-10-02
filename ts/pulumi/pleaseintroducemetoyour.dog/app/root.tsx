import { Links, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { DocumentMeta } from '#root/ts/remix/metadata.js';

export { ErrorBoundary } from '#root/ts/remix/error.js';

import '#root/ts/pulumi/pleaseintroducemetoyour.dog/app/base.css';

import { ReactNode } from 'react';
import { AnalyticsPageBeacon } from '#root/project/me/zemn/api/analytics/AnalyticsPageBeacon.js';
import { ClientProviders } from '#root/ts/pulumi/pleaseintroducemetoyour.dog/app/clientProviders.js';
import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTagsAppRouter,
	SourceExpression,
} from '#root/ts/remix/index.js';
import { Metadata } from '#root/ts/remix/metadata.js';

const csp_policy: CspPolicy = {
	...DefaultContentSecurityPolicy,
	'connect-src': new Set<SourceExpression>([
		'https://api.zemn.me',
		'http://localhost:*' as 'https://localhost',
		'https://*.reddit.com',
		'https://*.redd.it',
		...(DefaultContentSecurityPolicy['connect-src'] ?? []),
	]),
	'img-src': new Set([
		'https://*.redd.it',
		'https://*.reddit.com',
		...(DefaultContentSecurityPolicy['img-src'] ?? []),
	]),
	'media-src': new Set([
		'https://*.redd.it',
		'https://*.reddit.com',
		...(DefaultContentSecurityPolicy['media-src'] ?? []),
	]),
};

export interface Props {
	readonly children?: ReactNode;
}

export function Layout({ children }: Props) {
	return (
		<html>
			<head>
				<DocumentMeta />
				<Links />
			</head>
			<body>
				<ClientProviders>
					<HeaderTagsAppRouter cspPolicy={csp_policy} />
					<AnalyticsPageBeacon />
					{children}
				</ClientProviders>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export const metadata: Metadata = {
	formatDetection: {
		telephone: false,
		email: false,
		url: false,
	},
	title: {
		default: 'pleaseintroducemetoyour.dog',
		template: '%s 🐕 pleaseintroducemetoyour.dog',
	},
};

export default function App() {
	return <Outlet />;
}

export const handle = { metadata };
