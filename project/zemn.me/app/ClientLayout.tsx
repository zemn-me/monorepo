'use client';
import 'project/zemn.me/app/base.css';

import Head from 'next/head';
import { ReactNode } from 'react';
import { HeaderTags } from 'ts/next.js';

export interface Props {
	readonly children?: ReactNode;
}

export function ClientLayout({ children }: Props) {
	return (
		<>
			<HeaderTags />
			{children}
			<Head>
				<link href="/icon.svg" rel="icon" type="image/svg+xml" />
				<link
					href="/icon.svg"
					rel="apple-touch-icon"
					type="image/svg+xml"
				/>
				<meta content="@zemnmez" name="twitter:site" />
				<meta content="@zemnnmez" name="twitter:creator" />
				<meta content="zemnmez" name="author" />
				<meta
					content="width=device-width,initial-scale=1,shrink-to-fit=no,viewport-fit=cover"
					name="viewport"
				/>
			</Head>
		</>
	);
}

export default ClientLayout;
