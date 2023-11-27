import 'project/zemn.me/next/pages/base.css';

import type { NextPage } from 'next';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ReactElement, ReactNode } from 'react';
import { HeaderTags } from 'ts/next.js';

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
	getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
	readonly Component: NextPageWithLayout;
};

export function App({ Component, pageProps }: AppPropsWithLayout) {
	// Use the layout defined at the page level, if available
	const getLayout = Component.getLayout ?? (page => page);

	return getLayout(
		<>
			<HeaderTags />
			<Component {...pageProps} />
			<Head>
				<link href="icon.svg" rel="icon" type="image/svg+xml" />
				<link
					href="icon.svg"
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

export default App;
