'use client';
import { useEffect } from 'react';
/**
 * @fileoverview Redirect compatible with the app router.
 */
import { useNavigate } from 'react-router';

import { RedirectBlurb } from '#root/ts/remix/component/Redirect/blurb.js';

export interface Props {
	readonly to: URL | string;
	readonly linkClassName?: string;
}

export default function Redirect({ to, ...props }: Props) {
	const href = typeof to === 'string' ? to : to.toString();
	const navigate = useNavigate();
	useEffect(() => {
		if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href))
			window.location.replace(href);
		else void navigate(href, { replace: true });
	}, [href, navigate]);
	return (
		<>
			<title>{`Redirect to ${to}`}</title>
			<meta content={`1; ${to}`} httpEquiv="refresh" />
			<link href={href} rel="canonical" />
			<RedirectBlurb {...{ to, ...props }} />
		</>
	);
}
