"use client";
import memoize from 'memoizee';
import { useEffect } from 'react';
import { trustedTypes } from 'trusted-types';
import { TrustedHTML } from 'trusted-types/lib';

const trustedTypesPolicy = memoize(() =>
	trustedTypes.createPolicy("default", {
		createHTML: v => v
	})
);

/**
 * Declare an HTML fragment as safe against XSS. If no policy
 * is set, then this function is an identity operation.
 */
export function dangerouslyDeclareSafeHTML(html: string) {
	// below is needed because window can be
	// undefined in next prerender.
	const h = (trustedTypesPolicy().createHTML)(html)

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (globalThis?.window?.TrustedHTML && !(h instanceof TrustedHTML)) {
		throw new Error(`Expected TrustedHTML, got ${typeof h}`);
	}

	return h;
}

/**
 * React component that declares a trusted types policy when mounted.
 *
 * Unmounting it has no effect.
 */
export function DeclareTrustedTypesPolicy() {
	useEffect(() => {
		trustedTypesPolicy();
	}, []);
	return null;
}

