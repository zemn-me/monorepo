import classNames from 'classnames';
import React from 'react';
import { Link as RouterLink } from 'react-router';

import style from '#root/project/me/zemn/components/Link/link.module.css';
import { RelativeURL } from '#root/ts/remix/index.js';

type LinkHref = string | URL | RelativeURL;

export interface LinkProps extends Omit<
	React.AnchorHTMLAttributes<HTMLAnchorElement>,
	'href'
> {
	readonly href?: LinkHref;
	readonly styleless?: boolean;
}

/**
 * A set of schemes which are considered first-party regardless of origin.
 */
export const firstPartySchemes = new Set(['mailto:', 'tel:']);

export const firstPartyOrigins = new Set([
	'https://zemn.me',
	'https://staging.zemn.me',
]);

function hrefString(href: LinkHref): string {
	if (href instanceof RelativeURL) return href.value;
	if (href instanceof URL) return href.toString();
	return href;
}

function isFirstPartyURL(href: LinkHref): boolean {
	if (href instanceof RelativeURL) return true;
	const value = hrefString(href);
	return [...firstPartyOrigins].some(origin => {
		const url = new URL(value, origin);
		return (
			firstPartySchemes.has(url.protocol) ||
			firstPartyOrigins.has(url.origin)
		);
	});
}

function shouldUseRouterLink(href: LinkHref): boolean {
	const value = hrefString(href);
	return (
		href instanceof RelativeURL ||
		value.startsWith('/') ||
		(!value.startsWith('//') && !/^[a-z][a-z0-9+.-]*:/i.test(value))
	);
}

export function Link({
	className,
	href,
	rel,
	styleless,
	target,
	...props
}: LinkProps) {
	className = classNames(className, styleless ? style.styleless : style.link);

	if (href === undefined) {
		return <a {...{ className, href, rel, target, ...props }} />;
	}

	const url = hrefString(href);
	if (!isFirstPartyURL(href)) {
		rel = `${rel ?? ''} external`.trim();
		target = '_blank';
	}

	if (shouldUseRouterLink(href)) {
		return (
			<RouterLink {...{ className, rel, target, to: url, ...props }} />
		);
	}

	return <a {...{ className, href: url, rel, target, ...props }} />;
}

export default Link;
