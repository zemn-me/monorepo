import type { AppProps } from 'next/app';

import { DefaultContentSecurityPolicy, HeaderTagsPagesRouter } from '#root/ts/next.js/index.js';

export function App({ Component, pageProps }: AppProps) {
	const pageCsp = {
		...DefaultContentSecurityPolicy,
		'script-src': new Set([
			...(DefaultContentSecurityPolicy['script-src'] ?? []),
			'https://cdn.jsdelivr.net',
		]),
		'connect-src': new Set([
			...(DefaultContentSecurityPolicy['connect-src'] ?? []),
			'https://www.wikidata.org',
		] as const),
		'img-src': new Set([
			...(DefaultContentSecurityPolicy['img-src'] ?? []),
			'https://upload.wikimedia.org',
			'https://commons.wikimedia.org',
		] as const),
	};

	return (
		<>
			<HeaderTagsPagesRouter cspPolicy={pageCsp} domain="luke.shadwell.im" />
			<Component {...pageProps} />
		</>
	);
}

export default App;
