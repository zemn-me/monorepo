import { NewType } from '#root/ts/NewType.js';
import { DeclareTrustedTypesPolicy } from '#root/ts/trusted_types/trusted_types.js';

type scheme = 'https:' | 'data:';
type schemeSource = scheme;
type hostSource = `${schemeSource}//${string}`;
type keyword = 'none' | 'self' | 'unsafe-inline' | 'unsafe-eval' | 'script';
type keywordSource = `'${keyword}'`;
export type SourceExpression = schemeSource | hostSource | keywordSource;
type cspValue = SourceExpression | 'default';
type sourceList = Set<cspValue>;
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

export type CspPolicy = Partial<Record<directives, sourceList>>;

/**
 * A pathname that is known to be relative to the current app.
 */
export class RelativeURL extends NewType<string> {}

type MetadataTitle =
	| string
	| {
			readonly absolute?: string;
			readonly default?: string;
			readonly template?: string;
	  };

type MetadataUrl = string | URL;
type MetadataAuthor =
	| string
	| {
			readonly name?: string;
			readonly url?: MetadataUrl;
	  };
type ThemeColor =
	| string
	| {
			readonly color: string;
			readonly media?: string;
	  };
type MetadataImage =
	| MetadataUrl
	| {
			readonly url: MetadataUrl;
			readonly alt?: string;
			readonly height?: number;
			readonly width?: number;
	  };

interface TwitterMetadata {
	readonly card?: string;
	readonly creator?: string;
	readonly description?: string;
	readonly images?: MetadataImage | readonly MetadataImage[];
	readonly site?: string;
	readonly title?: string;
	readonly [key: string]: unknown;
}

interface OpenGraphMetadata {
	readonly description?: string;
	readonly emails?: string | readonly string[];
	readonly firstName?: string;
	readonly images?: MetadataImage | readonly MetadataImage[];
	readonly lastName?: string;
	readonly publishedTime?: string;
	readonly siteName?: string;
	readonly title?: string;
	readonly type?: string;
	readonly url?: MetadataUrl;
	readonly username?: string;
	readonly [key: string]: unknown;
}

export interface Metadata {
	readonly title?: MetadataTitle;
	readonly description?: string;
	readonly formatDetection?: Record<string, boolean>;
	readonly alternates?: {
		readonly canonical?: MetadataUrl;
	};
	readonly authors?: readonly MetadataAuthor[];
	readonly metadataBase?: URL;
	readonly openGraph?: OpenGraphMetadata;
	readonly themeColor?: ThemeColor | readonly ThemeColor[];
	readonly twitter?: TwitterMetadata;
	readonly [key: string]: unknown;
}

export type MetaDescriptor =
	| {
			readonly title: string;
	  }
	| {
			readonly name: string;
			readonly content: string;
			readonly media?: string;
	  }
	| {
			readonly property: string;
			readonly content: string;
	  }
	| {
			readonly httpEquiv: string;
			readonly content: string;
	  }
	| {
			readonly tagName: 'meta' | 'link';
			readonly [name: string]: string;
	  }
	| {
			readonly [name: string]: unknown;
	  };

export interface MetadataRouteContext {
	readonly location?: {
		readonly pathname: string;
	};
	readonly matches?: readonly {
		readonly meta: readonly MetaDescriptor[];
	}[];
}

export interface MetadataToMetaDescriptorsOptions {
	/**
	 * Metadata inherited from the root layout. React Router only renders the
	 * leaf route's meta output, so leaf routes need to carry root tags forward.
	 */
	readonly inheritedMetadata?: Metadata;
	readonly route?: MetadataRouteContext;
}

export interface Viewport {
	readonly width?: string;
	readonly initialScale?: number;
	readonly maximumScale?: number;
	readonly minimumScale?: number;
	readonly userScalable?: boolean;
	readonly [key: string]: string | number | boolean | undefined;
}

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
	'trusted-types': new Set(['default']),
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

export function HeaderTags({
	cspPolicy = DefaultContentSecurityPolicy,
}: HeaderTagsProps) {
	return (
		<>
			<DeclareTrustedTypesPolicy />
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

const isDefined = <T,>(value: T | undefined): value is T => value !== undefined;

const asArray = <T,>(value: T | readonly T[] | undefined): readonly T[] => {
	if (value === undefined) return [];
	return Array.isArray(value) ? (value as readonly T[]) : [value as T];
};

const contentString = (value: unknown): string | undefined => {
	if (value === undefined || value === null) return;
	if (value instanceof URL) return value.toString();
	return String(value);
};

const kebabCase = (value: string): string =>
	value.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

const snakeCase = (value: string): string =>
	value.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);

const metadataBase = (
	metadata: Metadata,
	inheritedMetadata?: Metadata
): URL | undefined => metadata.metadataBase ?? inheritedMetadata?.metadataBase;

const pathname = (route?: MetadataRouteContext): string =>
	route?.location?.pathname ?? '/';

function resolveMetadataUrl(
	value: MetadataUrl,
	base: URL | undefined,
	route: MetadataRouteContext | undefined
): string {
	const raw = value instanceof URL ? value.toString() : value;
	if (base === undefined) return raw;

	if (raw === '.' || raw === './') {
		return new URL(pathname(route), base).toString();
	}

	return new URL(raw, base).toString();
}

function titleValue(title: MetadataTitle | undefined): {
	readonly absolute: boolean;
	readonly value?: string;
} {
	if (typeof title === 'string') return { absolute: false, value: title };
	if (title?.absolute) return { absolute: true, value: title.absolute };
	return { absolute: false, value: title?.default };
}

function titleTemplate(title: MetadataTitle | undefined): string | undefined {
	if (typeof title === 'string') return;
	return title?.template;
}

function titleDescriptor(
	metadata: Metadata,
	inheritedMetadata?: Metadata
): MetaDescriptor | undefined {
	const title = titleValue(metadata.title);
	if (!title.value) return;
	if (title.absolute) return { title: title.value };

	const template = titleTemplate(inheritedMetadata?.title);
	return {
		title: template?.includes('%s')
			? template.replace('%s', title.value)
			: title.value,
	};
}

function formatDetectionDescriptor(
	formatDetection: Metadata['formatDetection']
): MetaDescriptor | undefined {
	const content = Object.entries(formatDetection ?? {})
		.filter(([, enabled]) => enabled === false)
		.map(([name]) => `${kebabCase(name)}=no`)
		.join(', ');

	return content ? { content, name: 'format-detection' } : undefined;
}

function authorDescriptors(
	authors: Metadata['authors']
): readonly MetaDescriptor[] {
	return asArray(authors)
		.map(author => {
			if (typeof author === 'string') return author;
			return author.name;
		})
		.filter(isDefined)
		.map(author => ({ content: author, name: 'author' }));
}

function themeColorDescriptors(
	themeColor: Metadata['themeColor']
): readonly MetaDescriptor[] {
	return asArray(themeColor)
		.map(theme => {
			if (typeof theme === 'string') {
				return { content: theme, name: 'theme-color' };
			}

			return {
				content: theme.color,
				media: theme.media,
				name: 'theme-color',
			};
		})
		.filter(theme => theme.content !== '');
}

function canonicalDescriptor(
	metadata: Metadata,
	inheritedMetadata: Metadata | undefined,
	route: MetadataRouteContext | undefined
): MetaDescriptor | undefined {
	const canonical = metadata.alternates?.canonical;
	if (!canonical) return;
	return {
		href: resolveMetadataUrl(
			canonical,
			metadataBase(metadata, inheritedMetadata),
			route
		),
		rel: 'canonical',
		tagName: 'link',
	};
}

function imageUrl(
	image: MetadataImage,
	base: URL | undefined,
	route: MetadataRouteContext | undefined
): string {
	if (typeof image === 'string' || image instanceof URL) {
		return resolveMetadataUrl(image, base, route);
	}

	return resolveMetadataUrl(image.url, base, route);
}

function openGraphDescriptors(
	openGraph: OpenGraphMetadata | undefined,
	base: URL | undefined,
	route: MetadataRouteContext | undefined
): readonly MetaDescriptor[] {
	if (!openGraph) return [];

	const descriptors: MetaDescriptor[] = [];
	const knownProperties: Record<string, string> = {
		description: 'og:description',
		firstName: 'profile:first_name',
		lastName: 'profile:last_name',
		publishedTime: 'article:published_time',
		siteName: 'og:site_name',
		title: 'og:title',
		type: 'og:type',
		username: 'profile:username',
	};

	for (const [key, value] of Object.entries(openGraph)) {
		if (key === 'images') {
			for (const image of asArray(
				value as MetadataImage | readonly MetadataImage[]
			)) {
				descriptors.push({
					content: imageUrl(image, base, route),
					property: 'og:image',
				});
			}
			continue;
		}

		if (key === 'url') {
			descriptors.push({
				content: resolveMetadataUrl(value as MetadataUrl, base, route),
				property: 'og:url',
			});
			continue;
		}

		if (key === 'emails') {
			for (const email of asArray(value as string | readonly string[])) {
				descriptors.push({ content: email, property: 'og:email' });
			}
			continue;
		}

		const property = knownProperties[key] ?? `og:${snakeCase(key)}`;
		const content = contentString(value);
		if (content) descriptors.push({ content, property });
	}

	return descriptors;
}

function twitterDescriptors(
	twitter: TwitterMetadata | undefined,
	base: URL | undefined,
	route: MetadataRouteContext | undefined
): readonly MetaDescriptor[] {
	if (!twitter) return [];

	const descriptors: MetaDescriptor[] = [];
	const knownNames = new Set([
		'card',
		'creator',
		'description',
		'site',
		'title',
	]);

	for (const [key, value] of Object.entries(twitter)) {
		if (key === 'images') {
			for (const image of asArray(
				value as MetadataImage | readonly MetadataImage[]
			)) {
				descriptors.push({
					content: imageUrl(image, base, route),
					name: 'twitter:image',
				});
			}
			continue;
		}

		if (!knownNames.has(key)) continue;

		const content = contentString(value);
		if (content) descriptors.push({ content, name: `twitter:${key}` });
	}

	return descriptors;
}

function metadataDescriptors(
	metadata: Metadata,
	route: MetadataRouteContext | undefined,
	inheritedMetadata?: Metadata
): readonly MetaDescriptor[] {
	const base = metadataBase(metadata, inheritedMetadata);

	return [
		titleDescriptor(metadata, inheritedMetadata),
		metadata.description
			? { content: metadata.description, name: 'description' }
			: undefined,
		...themeColorDescriptors(metadata.themeColor),
		...authorDescriptors(metadata.authors),
		formatDetectionDescriptor(metadata.formatDetection),
		canonicalDescriptor(metadata, inheritedMetadata, route),
		...openGraphDescriptors(metadata.openGraph, base, route),
		...twitterDescriptors(metadata.twitter, base, route),
	].filter(isDefined);
}

function inheritedRouteDescriptors(
	route: MetadataRouteContext | undefined
): readonly MetaDescriptor[] {
	return route?.matches?.slice(0, -1).flatMap(match => match.meta) ?? [];
}

function metaDescriptorKey(descriptor: MetaDescriptor, index: number): string {
	if ('title' in descriptor) return 'title';
	if ('name' in descriptor && typeof descriptor.name === 'string') {
		if (descriptor.name === 'author') {
			return `name:author:${descriptor.content}`;
		}
		if (descriptor.name === 'theme-color') {
			return `name:theme-color:${descriptor.media ?? ''}`;
		}
		if (descriptor.name === 'twitter:image') {
			return `name:twitter:image:${descriptor.content}`;
		}
		return `name:${descriptor.name}`;
	}
	if ('property' in descriptor && typeof descriptor.property === 'string') {
		if (descriptor.property === 'og:image') {
			return `property:og:image:${descriptor.content}`;
		}
		return `property:${descriptor.property}`;
	}
	if ('httpEquiv' in descriptor && typeof descriptor.httpEquiv === 'string') {
		return `httpEquiv:${descriptor.httpEquiv}`;
	}
	if (
		'tagName' in descriptor &&
		descriptor.tagName === 'link' &&
		typeof descriptor.rel === 'string'
	) {
		return `link:${descriptor.rel}`;
	}
	return `descriptor:${index}`;
}

function dedupeMetaDescriptors(
	descriptors: readonly MetaDescriptor[]
): readonly MetaDescriptor[] {
	const indexes = new Map<string, number>();
	const output: MetaDescriptor[] = [];

	for (const descriptor of descriptors) {
		const key = metaDescriptorKey(descriptor, output.length);
		const index = indexes.get(key);
		if (index === undefined) {
			indexes.set(key, output.length);
			output.push(descriptor);
			continue;
		}

		output[index] = descriptor;
	}

	return output;
}

export function metadataToMetaDescriptors(
	metadata: Metadata = {},
	options: MetadataToMetaDescriptorsOptions = {}
): readonly MetaDescriptor[] {
	const inheritedDescriptors = options.inheritedMetadata
		? metadataDescriptors(options.inheritedMetadata, options.route)
		: inheritedRouteDescriptors(options.route);

	return dedupeMetaDescriptors([
		...inheritedDescriptors,
		...metadataDescriptors(
			metadata,
			options.route,
			options.inheritedMetadata
		),
	]);
}

export function viewportToMetaDescriptors(
	viewport: Viewport | undefined
): readonly MetaDescriptor[] {
	if (viewport === undefined) return [];

	const content = Object.entries(viewport)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => {
			const renderedValue =
				typeof value === 'boolean' ? (value ? 'yes' : 'no') : value;
			return `${kebabCase(key)}=${renderedValue}`;
		})
		.join(', ');

	return content ? [{ content, name: 'viewport' }] : [];
}
