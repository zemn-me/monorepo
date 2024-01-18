import type { AppProps } from 'next/app';
import { HeaderTagsPagesRouter } from 'ts/next.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTagsPagesRouter />
			<Component {...pageProps} />
		</>
	);
}

export default App;
