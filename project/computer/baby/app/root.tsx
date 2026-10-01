import { Links, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { DocumentMeta } from '#root/ts/remix/metadata.js';

export { ErrorBoundary } from '#root/ts/remix/error.js';

import React, { ReactNode } from 'react';

import { AnalyticsPageBeacon } from '#root/project/me/zemn/api/analytics/AnalyticsPageBeacon.js';
import {
	DefaultContentSecurityPolicy,
	HeaderTagsAppRouter,
	SourceExpression,
} from '#root/ts/remix/index.js';

const csp = {
	...DefaultContentSecurityPolicy,
	'connect-src': new Set<SourceExpression>([
		...(DefaultContentSecurityPolicy['connect-src'] ?? []),
		'https://api.zemn.me',
		'http://localhost:*' as 'https://localhost',
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
				<HeaderTagsAppRouter cspPolicy={csp} />
				<AnalyticsPageBeacon />
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
