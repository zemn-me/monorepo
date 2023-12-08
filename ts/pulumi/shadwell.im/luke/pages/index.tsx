import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const target = 'https://steady.dev';

export default function Main() {
	const router = useRouter();
	useEffect(() => {
		void router.replace(target);
	}, []);
	return (
		<>
			<Head>
				<title>Luke</title>
				<meta content={`10; ${target}`} httpEquiv="refresh" />
				<link href={target} rel="canonical" />
			</Head>
		</>
	);
}
