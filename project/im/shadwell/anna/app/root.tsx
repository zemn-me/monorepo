import { Links, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { DocumentMeta } from '#root/ts/remix/metadata.js';

export { ErrorBoundary } from '#root/ts/remix/error.js';

import { ReactNode } from 'react';

import { HeaderTagsAppRouter } from '#root/ts/remix/index.js';

export interface Props {
	readonly children?: ReactNode;
}

export function Layout({ children }: Props) {
	return (
		<html>
			<head>
				<DocumentMeta />
				<Links />
				<HeaderTagsAppRouter />
			</head>
			<body>
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
