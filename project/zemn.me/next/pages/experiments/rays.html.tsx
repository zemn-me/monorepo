/**
 * @fileoverview In commit 56e8bcfa298e2f205a96e89d55cb9b0b47b1a0f6,
 * I made all page_name.html that next.js generates get renamed to just
 * page_name.html but get served as the appropriate MIME type.
 *
 * This resulted in /experiments/rays.html being changed to /experiments/rays,
 * breaking a few links I made that went to it on Twitter and stuff.
 *
 * Ideally, I'd make a redirect from the old path to the new path as the
 * WWW intends, but it looks like to do that I'd need to add a lambda function
 * to my CloudFront instance, and that sounds stupid and expensive.
 *
 * So for now, I'm just doing the redirect on the client side. Sorry!
 * @see https://github.com/zemn-me/monorepo/commit/56e8bcfa298e2f205a96e89d55cb9b0b47b1a0f6
 */

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

import Link from '#monorepo/project/zemn.me/next/components/Link/index.js';

const targetRoute = '/experiments/rays';

export default function Redirector() {
	const router = useRouter();
	useEffect(() => {
		void router.replace(targetRoute);
	}, []);

	return (
		<>
			<Head>
				<meta content={`0;URL='${targetRoute}'`} httpEquiv="refresh" />
			</Head>
			<p>
				I moved this to a new address{' '}
				<Link href={targetRoute}>here</Link>.
			</p>
		</>
	);
}
