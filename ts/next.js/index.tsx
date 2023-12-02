import Head from 'next/head';
import Script from 'next/script';

export * as config from 'ts/next.js/next.config';

const isDevMode = process?.env?.NODE_ENV === 'development';

class CSPDirectiveList extends Set {
	toString(): string {
		return [...super.values()].join(' ');
	}
}

class CSPDirective {
	constructor(
		private readonly directive: string,
		private readonly directiveList: CSPDirectiveList
	) {}
	toString(): string {
		return [this.directive, this.directiveList].join(' ');
	}
}

const script_src_directives = new CSPDirectiveList([
	"'self'",
	'https://*.google-analytics.com',
]);

const csp_rules: CSPDirective[] = [
	new CSPDirective(
		'style-src',
		new CSPDirectiveList([
			"'self'",
			"'unsafe-inline'",
			'https://fonts.googleapis.com',
		])
	),
	new CSPDirective(
		'img-src',
		new CSPDirectiveList([
			"'self'",
			"'unsafe-inline'",
			'data:',
			'https://*.google-analytics.com',
			'https://*.g.doubleclick.net',
		])
	),
	new CSPDirective(
		'font-src',
		new CSPDirectiveList([
			"'self'",
			'https://fonts.gstatic.com',
			'https://fonts.googleapis.com',
		])
	),
	new CSPDirective(
		'connect-src',
		new CSPDirectiveList(["'self'", 'https://*.google-analytics.com'])
	),
	new CSPDirective('script-src', script_src_directives),
];

if (isDevMode) {
	["'unsafe-inline'", "'unsafe-eval'"].forEach(v =>
		script_src_directives.add(v)
	);

	csp_rules.push(
		new CSPDirective(
			'default-src',
			new CSPDirectiveList(["'self'", "'unsafe-eval'"])
		)
	);
}

declare const ga: (...params: unknown[]) => void;
export function HeaderTags() {
	return (
		<>
			<Script
				async
				id="ga"
				onError={() =>
					console.error('unable to load google analytics :(')
				}
				onLoad={() => {
					ga('create', 'UA-134479219-1', 'auto');
					ga('send', 'pageview');
				}}
				src="https://ssl.google-analytics.com/analytics.js"
				strategy="lazyOnload"
			/>
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
		</>
	);
}
