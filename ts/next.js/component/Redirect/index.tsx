import { Head } from 'next/head.js';
import { useRouter } from 'next/router.js';
import { useEffect } from 'react';

export interface Props {
	readonly to: string;
}

export default function Redirect({ to }: Props) {
	const router = useRouter();
	useEffect(() => void router.replace(to), []);
	return (
		<Head>
			<title>{`Redirect to ${to}`}</title>
			<meta content={`1; ${to}`} httpEquiv="refresh" />
			<link href={to} rel="canonical" />
		</Head>
	);
}
