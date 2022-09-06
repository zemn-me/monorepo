import * as elements from 'linear2/features/elements';
import Head from 'next/head';
import React from 'react';
import { RecoilRoot } from 'recoil';

export const Base: React.FC = ({ children }) => (
	<RecoilRoot>
		<Head>
			<meta
				content={[
					"default-src 'self'",
					"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
					"img-src 'self' data:",
					"font-src 'self' https://fonts.gstatic.com",
				].join('; ')}
				httpEquiv="Content-Security-Policy"
			/>

			<meta
				content="same-origin"
				httpEquiv="Cross-Origin-Resource-Policy"
			/>

			<meta
				content="same-origin"
				httpEquiv="Cross-Origin-Opener-Policy"
			/>
			<meta content="nosniff" httpEquiv="X-Content-Type-Options" />

			<meta content="no-referrer" name="referrer" />
		</Head>

		<main className={`${elements.style.root}`}>{children}</main>
	</RecoilRoot>
);

export default Base;
