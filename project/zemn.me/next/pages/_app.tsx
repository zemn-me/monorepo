import 'project/zemn.me/next/pages/base.css';

import type { AppProps } from 'next/app';
import Head from 'next/head';
import { NextPage } from 'next/types';
import { ReactElement, ReactNode } from 'react';
import { HeaderTags } from 'ts/next.js';

export type NextPageWithLayout<P = object, IP = P> = NextPage<P, IP> & {
	getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
	readonly Component: NextPageWithLayout;
};

export function App({ Component, pageProps }: AppPropsWithLayout) {
	const getLayout = Component.getLayout ?? (page => page);
	return (
		<>
			<HeaderTags />
			{getLayout(<Component {...pageProps} />)}
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

export default App;
