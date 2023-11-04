import 'project/zemn.me/next/pages/base.css';

import type { AppProps } from 'next/app';
import Head from 'next/head';
import Link from 'next/link';
import style from 'project/zemn.me/next/pages/index.module.css';
import React from 'react';
import { HeaderTags } from 'ts/next.js';

interface NavAccordionProps {
	readonly title?: React.ReactNode;
	readonly children?: React.ReactNode;
}

function NavAccordion(props: NavAccordionProps) {
	return (
		<details className={style.navDetails}>
			{props.title ? <summary>{props.title}</summary> : null}
			<div className={style.navAccordionBody}>{props.children}</div>
		</details>
	);
}

export function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<HeaderTags />
			<nav className={style.nav}>
				<Link href="/">Home (replace with logo)</Link>
				<Link href="/about">About</Link>
				<NavAccordion title="Experiments">
					<Link href="/experiments/rays">rays</Link>
				</NavAccordion>
			</nav>
			<Component {...pageProps} />
			<Head>
				<link href="icon.svg" rel="icon" type="image/svg+xml" />
				<link
					href="icon.svg"
					rel="apple-touch-icon"
					type="image/svg+xml"
				/>
				<meta content="@zemnmez" name="twitter:site" />
				<meta content="@zemnnmez" name="twitter:creator" />
				<meta content="zemnmez" name="author" />
				<meta
					content="width=device-width,initial-scale=1,shrink-to-fit=no,viewport-fit=cover"
					name="viewport"
				/>
			</Head>
		</>
	);
}

export default App;
