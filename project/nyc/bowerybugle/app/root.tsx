import { type ReactNode } from 'react';
import { Links, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { DocumentMeta } from '#root/ts/remix/metadata.js';
import { Providers } from './providers.js';
import './style.css';

export { ErrorBoundary } from '#root/ts/remix/error.js';

export function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1"
				/>
				<meta name="referrer" content="no-referrer" />
				<DocumentMeta />
				<Links />
			</head>
			<body>
				<Providers>{children}</Providers>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
export default function App() {
	return <Outlet />;
}
export const handle = {
	metadata: {
		title: {
			default: 'The Bowery Bugle',
			template: '%s · The Bowery Bugle',
		},
		description: 'The Bowery Bugle. Read the print issues.',
	},
};
