import Head from 'next/head';
import { useRouter } from 'next/router.js';
import { useEffect } from 'react';

import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';
import { RedirectBlurb } from '#root/ts/next.js/component/Redirect/blurb.js';

export interface Props {
	readonly to: string;
}

export default function Redirect({ to }: Props) {
	const router = useRouter();
	useEffect(() => void router.replace(to), [router, to]);
	return (
		<>
			<Head>
				<title>{`Redirect to ${to}`}</title>
				<meta content={`1; ${to}`} httpEquiv="refresh" />
				<link href={to} rel="canonical" />
			</Head>
			<RedirectBlurb {...{to}}/>
		</>
	);
}
