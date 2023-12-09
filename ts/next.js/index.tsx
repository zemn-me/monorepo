import Head from 'next/head';
import Script from 'next/script';

export * as config from 'ts/next.js/next.config';

type scheme = 'https:' | 'data:';
type schemeSource = scheme;
type hostSource = `${schemeSource}//${string}`;
type keyword = 'self' | 'unsafe-inline' | 'unsafe-eval';
type keywordSource = `'${keyword}'`;
type sourceExpression = schemeSource | hostSource | keywordSource;
type sourceList = Set<sourceExpression>;
type directives =
	| 'style-src'
	| 'img-src'
	| 'script-src'
	| 'connect-src'
	| 'default-src'
	| 'media-src'
	| 'font-src';

export type CspPolicy = Partial<Record<directives, sourceList>>;

const isDevMode = process?.env?.NODE_ENV === 'development';

export const DefaultContentSecurityPolicy: CspPolicy = {
	'style-src': new Set([
		"'self'",
		"'unsafe-inline'",
		'https://fonts.googleapis.com',
	]),
	'img-src': new Set([
		"'self'",
		"'unsafe-inline'",
		'data:',
		'https://*.google-analytics.com',
		'https://*.g.doubleclick.net',
	]),
	'font-src': new Set([
		"'self'",
		'https://fonts.gstatic.com',
		'https://fonts.googleapis.com',
	]),
	'connect-src': new Set([
		"'self'",
		'https://*.google-analytics.com',
		'https://*.doubleclick.net',
	]),
	'script-src': new Set([
		"'self'",
		'https://*.google-analytics.com',
		...(isDevMode
			? (["'unsafe-inline'", "'unsafe-eval'"] as const)
			: ([] as const)),
	]),
	...(isDevMode
		? {
				'default-src': new Set(["'self'", "'unsafe-eval'"]),
		  }
		: {}),
};

declare const ga: (...params: unknown[]) => void;

interface HeaderTagsProps {
	readonly cspPolicy?: CspPolicy;
}

export function HeaderTags({
	cspPolicy = DefaultContentSecurityPolicy,
}: HeaderTagsProps) {
	return (
		<>
			<Script
				async
				id="ga"
				onError={() =>
					console.error('unable to load google analytics :(')
				}
				onLoad={() => {
					ga('create', 'G-BBMLN07SPK', 'auto');
					ga('send', 'pageview');
				}}
				src="https://ssl.google-analytics.com/analytics.js"
				strategy="lazyOnload"
			/>
			<Head>
				<meta
					content={Object.entries(cspPolicy)
						.map(([k, v]) => [k, ...v].join(' '))
						.join('; ')}
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
