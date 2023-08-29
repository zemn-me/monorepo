import type { AppProps } from 'next/app';
import { HeaderTags } from 'monorepo/ts/next.js/index.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTags />
			<Component {...pageProps} />
		</>
	);
}

export default App;
