import 'project/zemn.me/app/base.css';

import { HeroLayout } from 'project/zemn.me/components/HeroLayout/HeroLayout';
import { ReactNode } from 'react';

export interface Props {
	readonly children?: ReactNode;
}

export function RootLayout({ children }: Props) {
	return (
		<html>
			<head>
				<meta
					content="width=device-width,initial-scale=1,shrink-to-fit=no,viewport-fit=cover"
					name="viewport"
				/>
				<meta
					content="Personal website and profile of Thomas Neil James Shadwell, also known as Zemnmez."
					name="description"
				/>
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
			</head>
			<body>
				<HeroLayout>{children}</HeroLayout>
			</body>
		</html>
	);
}

export default RootLayout;
