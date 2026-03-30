import type { AppProps } from 'next/app';

import { ClientProviders, HeaderTagsPagesRouter } from '#root/ts/next.js/index.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<ClientProviders>
			<HeaderTagsPagesRouter />
			<Component {...pageProps} />
		</ClientProviders>
	);
}

export default App;
