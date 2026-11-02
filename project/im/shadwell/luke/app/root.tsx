import { Links, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { DocumentMeta } from '#root/ts/remix/metadata.js';

export { ErrorBoundary } from '#root/ts/remix/error.js';

import { ReactNode } from 'react';

import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTagsAppRouter,
} from '#root/ts/remix/index.js';

const pageCsp: CspPolicy = {
	...DefaultContentSecurityPolicy,
	'connect-src': new Set([
		...(DefaultContentSecurityPolicy['connect-src'] ?? []),
		'https://www.wikidata.org',
	]),
	'img-src': new Set([
		...(DefaultContentSecurityPolicy['img-src'] ?? []),
		'https://upload.wikimedia.org',
		'https://commons.wikimedia.org',
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
				<HeaderTagsAppRouter cspPolicy={pageCsp} />
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
