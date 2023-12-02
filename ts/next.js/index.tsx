import Head from 'next/head';
import Script from 'next/script';
import { useEffect } from 'react';

export * as config from 'ts/next.js/next.config';

const isDevMode = process?.env?.NODE_ENV === 'development';

const BASE_CSP_RULES = [
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"img-src 'self' data: https://*.google-analytics.com https://*.g.doubleclick.net",
	"font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
	isDevMode
		? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
		: "script-src 'self' https://*.google-analytics.com",
];

declare const ga: (...params: unknown[]) => void;
export function HeaderTags() {
	const csp_rules = [
		...BASE_CSP_RULES,
		isDevMode
			? "default-src 'self' 'unsafe-inline' 'unsafe-eval'"
			: "default-src 'self'",
	];

	useEffect(() => {
		window.addEventListener('load', function () {
			ga('create', 'UA-134479219-1', 'auto');
			ga('send', 'pageview');
		});
	}, []);

	return (
		<Head>
			<meta
				content={csp_rules.join('; ')}
				httpEquiv="Content-Security-Policy"
			/>

			<Script
				async
				id="ga"
				src="https://ssl.google-analytics.com/analytics.js"
			/>

			<meta
				content="same-origin"
				httpEquiv="Cross-Origin-Resource-Policy"
			/>

			<meta
				content="same-origin"
				httpEquiv="Cross-Origin-Opener-Policy"
			/>
			<meta content="nosniff" httpEquiv="X-Content-Type-Options" />

			<meta content="no-referrer" name="referrer" />
		</Head>
	);
}
