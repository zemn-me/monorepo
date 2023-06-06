import type { AppProps } from 'next/app';
import Head from 'next/head';
import { HeaderTags } from 'ts/next.js';
import 'project/zemn.me/next/pages/base.css';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTags />
			<Component {...pageProps} />
			<Head>
				<meta content="@zemnmez" name="twitter:site" />
				<meta content="@zemnnmez" name="twitter:creator" />
				<meta content="zemnmez" name="author" />
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no"/>
			</Head>
		</>
	);
}

export default App;
