import type { AppProps } from 'next/app';

import { ClientProviders } from '#root/ts/next.js/component/ClientProviders/ClientProviders.js';
import { HeaderTagsPagesRouter } from '#root/ts/next.js/index.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<ClientProviders>
			<HeaderTagsPagesRouter />
			<Component {...pageProps} />
		</ClientProviders>
	);
}

export default App;
