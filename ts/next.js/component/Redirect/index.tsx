import Head from 'next/head';
import { useRouter } from 'next/router.js';
import { ReactNode, useEffect } from 'react';

import { RedirectBlurb } from '#root/ts/next.js/component/Redirect/blurb.js';

export interface Props {
	readonly to: string;
	readonly Link?: (v: { href: URL | string, children?: ReactNode }) => ReactNode
}

export default function Redirect({ to, ...props }: Props) {
	const router = useRouter();
	useEffect(() => void router.replace(to), [router, to]);
	return (
		<>
			<Head>
				<title>{`Redirect to ${to}`}</title>
				<meta content={`1; ${to}`} httpEquiv="refresh" />
				<link href={to} rel="canonical" />
			</Head>
			<RedirectBlurb {...{to, ...props}}/>
		</>
	);
}
