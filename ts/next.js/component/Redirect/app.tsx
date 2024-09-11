'use client';
/**
 * @fileoverview Redirect but compatible with
 * app router.
 */
import Head from 'next/head.js';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

import { RedirectBlurb } from '#root/ts/next.js/component/Redirect/blurb.js';

export interface Props {
	readonly to: URL | string;
	readonly Link?: (v: { href: URL | string, children?: ReactNode }) => ReactNode
}

export default function Redirect({ to, ...props }: Props) {
	const href = typeof to === 'string' ? to : to.toString();
	const router = useRouter();
	useEffect(() => void router.replace(href), [href, router]);
	return (
		<>
			<Head>
				<title>{`Redirect to ${to}`}</title>
				<meta content={`1; ${to}`} httpEquiv="refresh" />
				<link href={href} rel="canonical" />
			</Head>
			<RedirectBlurb {...{ to, ...props }} />
		</>
	);
}
