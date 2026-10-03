import {
	data,
	Links,
	type LoaderFunctionArgs,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteLoaderData,
} from 'react-router';
import { ServerSessionProvider } from '#root/project/me/zemn/hook/server_session.js';
import {
	privateHeaders,
	readSession,
} from '#root/project/me/zemn/hook/session.server.js';
import { DocumentMeta } from '#root/ts/remix/metadata.js';

export { ErrorBoundary } from '#root/ts/remix/error.js';

import '#root/project/me/zemn/app/base.css';

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/latin-ext-400.css';
import '@fontsource/lora/latin-700.css';
import '@fontsource/lora/latin-ext-700.css';
import '@fontsource/lora/latin-400-italic.css';
import '@fontsource/lora/latin-ext-400-italic.css';
import '@fontsource/lora/latin-700-italic.css';
import '@fontsource/lora/latin-ext-700-italic.css';
import '@fontsource/ibm-plex-mono/latin-300.css';
import '@fontsource/ibm-plex-mono/latin-ext-300.css';
import { ReactNode } from 'react';
import { AnalyticsPageBeacon } from '#root/project/me/zemn/api/analytics/AnalyticsPageBeacon.js';
import { Providers } from '#root/project/me/zemn/app/providers.js';
import { Bio } from '#root/project/me/zemn/bio/index.js';
import { ZEMN_ME_API_BASE } from '#root/project/me/zemn/constants/constants.js';
import { text } from '#root/ts/react/lang/index.js';
import {
	DefaultContentSecurityPolicy,
	HeaderTagsAppRouter,
	SourceExpression,
} from '#root/ts/remix/index.js';
import { Metadata, Viewport } from '#root/ts/remix/metadata.js';

export interface Props {
	readonly children?: ReactNode;
}

const journalObjectStorageSources = [
	'https://s3.amazonaws.com',
	'https://*.s3.amazonaws.com',
	'https://s3.us-east-1.amazonaws.com',
	'https://*.s3.us-east-1.amazonaws.com',
] satisfies SourceExpression[];

const csp = {
	...DefaultContentSecurityPolicy,
	'script-src': new Set<SourceExpression>([
		...DefaultContentSecurityPolicy['script-src']!,
		"'wasm-unsafe-eval'",
	]),
	'connect-src': new Set<SourceExpression>([
		...DefaultContentSecurityPolicy['connect-src']!,
		'https://accounts.google.com',
		'https://people.googleapis.com',
		'http://localhost:*' as 'https://localhost',
		ZEMN_ME_API_BASE as 'https://api.zemn.me',
		'https://www.googleapis.com', // dub-dub-dub?? what year is it?
		...journalObjectStorageSources,
	]),
	'img-src': new Set<SourceExpression>([
		...DefaultContentSecurityPolicy['img-src']!,
		'https://*.googleusercontent.com',
		'https://tile.openstreetmap.org',
	]),
	'media-src': new Set<SourceExpression>([
		...(DefaultContentSecurityPolicy['media-src'] ?? []),
		"'self'",
		'blob:',
		ZEMN_ME_API_BASE as 'https://api.zemn.me',
		...journalObjectStorageSources,
	]),
};

export const headers = () => privateHeaders;

export async function loader({ request }: LoaderFunctionArgs) {
	const verified = await readSession(request);
	return data(
		{ session: verified?.session ?? null },
		{ headers: privateHeaders }
	);
}

export function Layout({ children }: Props) {
	const initial = useRouteLoaderData<typeof loader>('root');
	return (
		<>
			<ServerSessionProvider session={initial?.session ?? null}>
				<Providers>
					<html style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
						<head>
							<DocumentMeta />
							<Links />
							<link
								href="/icon.svg"
								rel="icon"
								type="image/svg+xml"
							/>
							<link
								href="/icon.svg"
								rel="apple-touch-icon"
								type="image/svg+xml"
							/>
							<HeaderTagsAppRouter cspPolicy={csp} />
						</head>
						<body style={{ fontFamily: 'Lora, serif' }}>
							<ReactQueryDevtools initialIsOpen={false} />
							<AnalyticsPageBeacon />
							{children}
							<ScrollRestoration />
							<Scripts />
						</body>
					</html>
				</Providers>
			</ServerSessionProvider>
		</>
	);
}

export const viewport: Viewport = {
	themeColor: [
		{ media: '(prefers-color-scheme: dark)', color: '#00130e' },
		{ media: '(prefers-color-scheme: light)', color: '#fff' },
	],
};

export const metadata: Metadata = {
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

export default function App() {
	return <Outlet />;
}

export const handle = { metadata, viewport };
