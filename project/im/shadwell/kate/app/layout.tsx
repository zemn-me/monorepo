import './base.css';

import { ReactNode } from 'react';
import { Links, Meta, Scripts } from 'react-router';

import { HeaderTags } from '#root/ts/remix/index.js';

export interface Props {
	readonly children?: ReactNode;
}

export function RootLayout({ children }: Props) {
	return (
		<html>
			<head>
				<link href="https://fonts.googleapis.com" rel="preconnect" />
				<link
					crossOrigin="anonymous"
					href="https://fonts.gstatic.com"
					rel="preconnect"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&display=swap"
					rel="stylesheet"
				/>
				<Meta />
				<Links />
				<HeaderTags />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

export default RootLayout;
