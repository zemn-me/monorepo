/* biome-ignore-all lint/style/noRestrictedImports: this wrapper intentionally imports the restricted module */
/* biome-ignore-all lint/correctness/noRestrictedElements: this module intentionally uses restricted elements */
import type { UrlObject } from 'node:url';

import classNames from 'classnames';
import React from 'react';
import { Link as RouterLink, useInRouterContext } from 'react-router';

import { map, some } from '#root/ts/iter/index.js';
import style from '#root/ts/react/router/Link/Link.module.css';
import { RelativeURL } from '#root/ts/react/router/Link/relative_url.js';

export type LinkProps = Omit<
	React.AnchorHTMLAttributes<HTMLAnchorElement>,
	'href'
> & {
	readonly href?: string | URL | UrlObject | RelativeURL;
	readonly styleless?: boolean;
	readonly replace?: boolean;
	readonly scroll?: boolean;
	readonly prefetch?: boolean;
} & React.RefAttributes<HTMLAnchorElement>;

function hrefString(href: NonNullable<LinkProps['href']>): string {
	if (href instanceof RelativeURL) return href.value;
	if (typeof href === 'string') return href;
	if (href instanceof URL) return href.href;
	const query =
		typeof href.query === 'string'
			? href.query
			: new URLSearchParams(
					Object.entries(href.query ?? {}).flatMap(([key, value]) =>
						(Array.isArray(value) ? value : [value])
							.filter(v => v != null)
							.map(v => [key, String(v)])
					)
				).toString();
	return `${href.protocol ?? ''}${href.host ? `//${href.host}` : ''}${href.pathname ?? ''}${href.search ?? (query ? `?${query}` : '')}${href.hash ?? ''}`;
}

/**
 * A set of schemes which are considered first-party
 * regardless of origin.
 */
export const firstPartySchemes = new Set(['mailto:', 'tel:']);

export const firstPartyOrigins = new Set([
	'https://zemn.me',
	'https://staging.zemn.me',
]);

/**
 * Returns true if the URL is a first-party URL if served from
 * an internal page.
 *
 * A URL is considered an internal URL if it would refer to
 * a first party origin when hosted on an internal page.
 *
 * @example
 * isFirstPartyURL("/something.html") // true
 * @example
 * isFirstPartyURL("https://example.com") // false
 * @example
 * isFirstPartyURL("https://zemn.me/ok") // true
 */
function isFirstPartyURL(u: RelativeURL | string | UrlObject | URL): boolean {
	if (u instanceof RelativeURL) return true;
	// necessary because UrlObject is not compatible with browser's
	// new URL().
	const nu = hrefString(u);
	return some(
		map(firstPartyOrigins, origin => new URL(nu, origin)),
		v =>
			firstPartySchemes.has(v.protocol) || firstPartyOrigins.has(v.origin)
	);
}

export function Link({
	href,
	className,
	styleless,
	rel,
	target,
	replace,
	scroll,
	prefetch,
	...props
}: LinkProps) {
	const inRouter = useInRouterContext();
	if (href !== undefined && !isFirstPartyURL(href)) {
		rel = `${rel ?? ''} external`.trim();
		target = '_blank';
	}

	className = classNames(className, styleless ? style.styleless : undefined);

	const url = href === undefined ? undefined : hrefString(href);
	if (
		!inRouter ||
		url === undefined ||
		/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)
	)
		return <a {...{ className, href: url, rel, target, ...props }} />;
	return (
		<RouterLink
			{...props}
			className={className}
			to={url}
			rel={rel}
			target={target}
			replace={replace}
			preventScrollReset={scroll === false}
			prefetch={prefetch ? 'intent' : 'none'}
		/>
	);
}

export default Link;
