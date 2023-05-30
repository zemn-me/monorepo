import Head from 'next/head';

export * as config from 'ts/next.js/next.config';

export function HeaderTags() {
	return (
		<Head>
			<meta
				content={[
					"default-src 'self'",
					"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
					"img-src 'self' data:",
					"font-src 'self' https://fonts.gstatic.com",
				].join('; ')}
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
			{
				process?.env?.NODE_ENV === "development"
					? <meta
						content="default-src 'self' 'unsafe-inline' 'unsafe-eval'" 
						httpEquiv='Content-Security-Policy'/>
					: null
				
			}
		</Head>
	);
}
