import type { AppProps } from 'next/app';
import { HeaderTagsAppRouter } from '#//ts/next.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTagsAppRouter />
			<Component {...pageProps} />
		</>
	);
}

export default App;
