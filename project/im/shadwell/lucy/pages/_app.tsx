import type { AppProps } from 'next/app';

import { HeaderTagsPagesRouter } from '#root/ts/next.js/index.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTagsPagesRouter />
			<Component {...pageProps} />
		</>
	);
}

export default App;
