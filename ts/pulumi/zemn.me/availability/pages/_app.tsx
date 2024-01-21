import 'ts/pulumi/zemn.me/availability/pages/base.css';

import type { AppProps } from 'next/app';
import Head from 'next/head';

import { HeaderTagsPagesRouter } from '#root/ts/next.js.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTagsPagesRouter />
			<Component {...pageProps} />
			<Head>
				<meta content="@zemnmez" name="twitter:site" />
				<meta content="@zemnnmez" name="twitter:creator" />
				<meta content="zemnmez" name="author" />
				<meta
					content="width=device-width,initial-scale=1,shrink-to-fit=no"
					name="viewport"
				/>
			</Head>
		</>
	);
}

export default App;
