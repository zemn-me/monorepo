import Head from 'next/head';
import { TimeEye } from 'project/zemn.me/elements/TimeEye';

export default function Main() {
	return (
		<>
			<Head>
				<title>zemn.me</title>
				<meta name="go-import" content="zemn.me git https://github.com/zemnmez/go.git"/>
			</Head>

			<header>
				<h1>zemnmez</h1>
			</header>
			<main>
				<TimeEye/>
			</main>
		</>
	);
}
