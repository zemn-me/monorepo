import { useLocation, useMatches } from 'react-router';

/** Site metadata is attached to route handles so parent defaults survive navigation. */
export interface Metadata {
	title?: string | { default: string; template: string };
	description?: string;
	metadataBase?: URL;
	authors?: { name?: string; url?: string }[];
	alternates?: { canonical?: string };
	robots?: { index?: boolean; follow?: boolean };
	referrer?: string;
	formatDetection?: Record<string, boolean>;
	openGraph?: {
		type?: string;
		title?: string;
		description?: string;
		publishedTime?: string;
		emails?: string;
		firstName?: string;
		lastName?: string;
		username?: string;
	};
	twitter?: {
		title?: string;
		description?: string;
		card?: string;
		site?: string;
		creator?: string;
	};
}
export interface Viewport {
	width?: string;
	initialScale?: number;
	themeColor?: { media: string; color: string }[];
}
interface MetadataHandle {
	metadata?: Metadata;
	viewport?: Viewport;
}

export function resolveMetadata(handles: MetadataHandle[]) {
	let metadata: Metadata = {};
	let viewport: Viewport = {};
	let template: string | undefined;
	let title: string | undefined;
	for (const handle of handles) {
		const current = handle.metadata;
		viewport = { ...viewport, ...handle.viewport };
		if (!current) continue;
		metadata = { ...metadata, ...current };
		if (typeof current.title === 'string')
			title = template?.replace('%s', current.title) ?? current.title;
		else if (current.title) {
			title = current.title.default;
			template = current.title.template;
		}
	}
	return { metadata, viewport, title };
}

export function DocumentMeta() {
	const matches = useMatches();
	const { pathname } = useLocation();
	const { metadata, viewport, title } = resolveMetadata(
		matches.map(match => (match.handle ?? {}) as MetadataHandle)
	);
	const canonical = metadata.alternates?.canonical;
	const canonicalURL =
		canonical === './' && metadata.metadataBase
			? new URL(pathname, metadata.metadataBase).href
			: canonical;
	const graphNames: Record<string, string> = {
		emails: 'og:email',
		publishedTime: 'article:published_time',
		firstName: 'profile:first_name',
		lastName: 'profile:last_name',
		username: 'profile:username',
	};
	return (
		<>
			<meta charSet="utf-8" />
			<meta
				name="viewport"
				content={`width=${viewport.width ?? 'device-width'}, initial-scale=${viewport.initialScale ?? 1}`}
			/>
			{title && <title>{title}</title>}
			{metadata.description && (
				<meta name="description" content={metadata.description} />
			)}
			{canonicalURL && <link rel="canonical" href={canonicalURL} />}
			{metadata.authors?.map(author => (
				<meta key={author.name} name="author" content={author.name} />
			))}
			{metadata.authors
				?.filter(author => author.url)
				.map(author => (
					<link key={author.url} rel="author" href={author.url} />
				))}
			{metadata.referrer && (
				<meta name="referrer" content={metadata.referrer} />
			)}
			{metadata.robots && (
				<meta
					name="robots"
					content={[
						metadata.robots.index === false ? 'noindex' : 'index',
						metadata.robots.follow === false
							? 'nofollow'
							: 'follow',
					].join(', ')}
				/>
			)}
			{metadata.formatDetection && (
				<meta
					name="format-detection"
					content={Object.entries(metadata.formatDetection)
						.map(([key, value]) => `${key}=${value ? 'yes' : 'no'}`)
						.join(', ')}
				/>
			)}
			{Object.entries(metadata.openGraph ?? {}).map(([key, value]) => (
				<meta
					key={key}
					property={graphNames[key] ?? `og:${key}`}
					content={value}
				/>
			))}
			{Object.entries(metadata.twitter ?? {}).map(([key, value]) => (
				<meta key={key} name={`twitter:${key}`} content={value} />
			))}
			{viewport.themeColor?.map(theme => (
				<meta
					key={theme.media}
					name="theme-color"
					media={theme.media}
					content={theme.color}
				/>
			))}
		</>
	);
}
