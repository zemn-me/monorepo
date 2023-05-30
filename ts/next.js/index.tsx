import Head from 'next/head';

export * as config from 'ts/next.js/next.config';

export function HeaderTags() {
	return (
		<Head>
			<meta
				content="default-src 'self'"
				httpEquiv="Content-Security-Policy"
			/>
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
