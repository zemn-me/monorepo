import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { RedirectBlurb } from '#root/ts/next.js/component/Redirect/blurb';

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
