import type { AppProps } from 'next/app';
import { HeaderTags } from 'ts/next.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTags />
			<Component {...pageProps} />
			<meta content="@zemnmez" name="twitter:site" />
			<meta content="@zemnnmez" name="twitter:creator" />
			<meta content="zemnmez" name="author" />
		</>
	);
}

export default App;
