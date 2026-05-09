'use client';

import { useEffect } from 'react';
import Link from '#root/project/me/zemn/components/Link/index.js';
import style from '#root/project/me/zemn/components/Link/link.module.css';
import { Prose } from '#root/project/me/zemn/components/Prose/prose.js';

export interface RedirectProps {
	readonly to: URL | string;
}

export function Redirect({ to }: RedirectProps) {
	const href = typeof to === 'string' ? to : to.toString();
	useEffect(() => void window.location.replace(href), [href]);

	const target = new URL(href);
	const text = target.protocol === 'https:' ? target.host : target.origin;
	return (
		<>
			<title>{`Redirect to ${href}`}</title>
			<meta content={`1; ${href}`} httpEquiv="refresh" />
			<link href={href} rel="canonical" />
			<Prose>
				<i>
					You are being redirected to{' '}
					<Link className={style.link} href={href}>
						{text}
					</Link>
					. Please wait.
				</i>
			</Prose>
		</>
	);
}
