import type { AppProps } from 'next/app';
import { HeaderTags } from 'ts/next.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTags />
			<Component {...pageProps} />
		</>
	);
}

export default App;
