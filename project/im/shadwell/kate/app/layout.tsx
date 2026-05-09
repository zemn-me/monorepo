import 'project/im/shadwell/kate/app/base.css';

import { ReactNode } from 'react';

import { HeaderTagsAppRouter } from '#root/ts/next.js/index.js';

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
				<HeaderTagsAppRouter />
			</head>
			<body>{children}</body>
		</html>
	);
}

export default RootLayout;
