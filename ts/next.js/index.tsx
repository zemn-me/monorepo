import Head from 'next/head';

import { DeclareTrustedTypesPolicy } from '#root/ts/trusted_types/trusted_types.js';

export * as config from '#root/ts/next.js/next.config.js';

type scheme = 'https:' | 'data:';
type Localhost = `http://localhost:${string}`
type schemeSource = scheme;
type hostSource = `${schemeSource}//${string}` | Localhost;
type keyword = 'self' | 'unsafe-inline' | 'unsafe-eval' | 'script';
type keywordSource = `'${keyword}'`;
export type SourceExpression = schemeSource | hostSource | keywordSource;
type sourceList = Set<SourceExpression>;
type directives =
	| 'style-src'
	| 'img-src'
	| 'script-src'
	| 'connect-src'
	| 'default-src'
	| 'media-src'
	| 'font-src'
	| 'require-trusted-types-for'
	| 'trusted-types';

export type CspPolicy = Partial<Record<directives, sourceList>>;

const isDevMode = process.env.NODE_ENV === 'development';

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

	// temp disabled
	//'require-trusted-types-for': new Set(["'script'"]),
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	'trusted-types': new Set(['default', 'nextjs#bundler']) as any, // 🤷
	'script-src': new Set([
		"'self'",
		"'unsafe-inline'", // https://github.com/vercel/next.js/discussions/54907#discussioncomment-8178117
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

interface HeaderTagsProps {
	readonly cspPolicy?: CspPolicy;
}

export function HeaderTagsPagesRouter({
	cspPolicy = DefaultContentSecurityPolicy,
}: HeaderTagsProps) {
	return (
		<>
			<DeclareTrustedTypesPolicy/>
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

export function HeaderTagsAppRouter({
	cspPolicy = DefaultContentSecurityPolicy,
}: HeaderTagsProps) {
	return (
		<>
			<DeclareTrustedTypesPolicy/>
			<meta
				content={Object.entries(cspPolicy)
					.map(([k, v]) => [k, ...v].join(' '))
					.join(';')}
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
		</>
	);
}
