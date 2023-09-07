import Head from 'next/head';
import Script from 'next/script';
export * as config from 'ts/next.js/next.config';

const BASE_CSP_RULES = [
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"img-src 'self' data:",
	"font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
];

export function HeaderTags() {
	const csp_rules = [
		...BASE_CSP_RULES,
		process?.env?.NODE_ENV === 'development'
			? "default-src 'self' 'unsafe-inline' 'unsafe-eval'"
			: "default-src 'self'",
	];
	return (
		<>
			<Head>
				<meta
					content={csp_rules.join('; ')}
					httpEquiv="Content-Security-Policy"
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

			<Script src="https://www.googletagmanager.com/gtag/js?id=G-9MKZNPVNVS" />
			<Script id="google-analytics">
				{`
				window.dataLayer = window.dataLayer || [];
				function gtag(){dataLayer.push(arguments);}
				gtag('js', new Date());

				gtag('config', 'G-9MKZNPVNVS');
				`}
			</Script>
		</>
	);
}
