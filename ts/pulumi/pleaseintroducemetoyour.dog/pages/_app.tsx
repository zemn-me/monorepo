import 'ts/pulumi/pleaseintroducemetoyour.dog/pages/base.css';

import type { AppProps } from 'next/app';

import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTagsPagesRouter,
} from '#root/ts/next.js.js';

const csp_policy: CspPolicy = {
	...DefaultContentSecurityPolicy,
	'connect-src': new Set([
		'https://*.reddit.com',
		'https://*.redd.it',
		...(DefaultContentSecurityPolicy['connect-src'] ?? []),
	]),
	'img-src': new Set([
		'https://*.redd.it',
		'https://*.reddit.com',
		...(DefaultContentSecurityPolicy['img-src'] ?? []),
	]),
	'media-src': new Set([
		'https://*.redd.it',
		'https://*.reddit.com',
		...(DefaultContentSecurityPolicy['media-src'] ?? []),
	]),
};

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTagsPagesRouter cspPolicy={csp_policy} />
			<Component {...pageProps} />
		</>
	);
}

export default App;
