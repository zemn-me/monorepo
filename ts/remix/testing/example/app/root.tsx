import { Links, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { DocumentMeta } from '#root/ts/remix/metadata.js';

export { ErrorBoundary } from '#root/ts/remix/error.js';

import { ReactNode } from 'react';

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
				<label>
					Persistent note <input name="note" />
				</label>
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

export const handle = {
	metadata: { title: { default: 'Example', template: '%s | Example' } },
};
