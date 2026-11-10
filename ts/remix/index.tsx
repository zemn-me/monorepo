type scheme = 'https:' | 'data:' | 'blob:';
type schemeSource = scheme;
type hostSource = `${schemeSource}//${string}`;
type keyword =
	| 'none'
	| 'self'
	| 'unsafe-inline'
	| 'unsafe-eval'
	| 'wasm-unsafe-eval'
	| 'script';
type keywordSource = `'${keyword}'`;
export type SourceExpression = schemeSource | hostSource | keywordSource;
type sourceList = Set<SourceExpression>;
type directives =
	| 'style-src'
	| 'img-src'
	| 'script-src'
	| 'connect-src'
	| 'base-uri'
	| 'default-src'
	| 'media-src'
	| 'font-src'
	| 'object-src'
	| 'require-trusted-types-for'
	| 'trusted-types';

export type CspPolicy = Partial<
	Record<Exclude<directives, 'trusted-types'>, sourceList>
> & {
	'trusted-types'?: Set<string>;
};

const isDevMode = process.env.NODE_ENV === 'development';

export const DefaultContentSecurityPolicy: CspPolicy = {
	'base-uri': new Set(["'none'"]),
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

	'trusted-types': new Set(["'none'"]),
	'script-src': new Set([
		"'self'",
		"'unsafe-inline'",
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

export function HeaderTagsAppRouter({
	cspPolicy = DefaultContentSecurityPolicy,
}: HeaderTagsProps) {
	return (
		<>
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
