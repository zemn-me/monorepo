import { HeaderTags } from 'monorepo/ts/next.js';
import type { AppProps } from 'next/app';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTags />
			<Component {...pageProps} />
		</>
	);
}

export default App;
