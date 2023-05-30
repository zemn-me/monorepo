import type { AppProps } from 'next/app';
import { HeaderTags } from 'ts/next.js';

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTags />
			<Component {...pageProps} />
			<meta name="twitter:site" content="@zemnmez"/>
			<meta name="twitter:creator" content="@zemnnmez"/>
			<meta name="author" content="zemnmez"/>
		</>
	);
}

export default App;
