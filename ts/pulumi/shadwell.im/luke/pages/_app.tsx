import type { AppProps } from 'next/app';

import { HeaderTagsAppRouter } from '#root/ts/next.js/index.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTagsAppRouter />
			<Component {...pageProps} />
		</>
	);
}

export default App;
