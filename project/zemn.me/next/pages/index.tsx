import Head from 'next/head';
import * as bio from 'project/zemn.me/bio';
import { TimeEye } from 'project/zemn.me/elements/TimeEye';
import Timeline from 'project/zemn.me/next/pages/timeline';
import * as lang from 'ts/react/lang';

export default function Main() {
	return (
		<>
			<Head>
				<title lang={lang.get(bio.Bio.who.handle)}>
					{lang.text(bio.Bio.who.handle)}
				</title>
				<meta
					content="zemn.me git https://github.com/zemnmez/go.git"
					name="go-import"
				/>
			</Head>

			<header>
				<h1 lang={lang.get(bio.Bio.who.handle)}>
					{lang.text(bio.Bio.who.handle)}
				</h1>
			</header>
			<main>
				<section>
					<header>
						<TimeEye />
						<h2 lang={lang.get(bio.Bio.who.fullName)}>
							{lang.text(bio.Bio.who.fullName)}
						</h2>
					</header>
					{bio.Bio.links !== undefined ? (
						<nav>
							{bio.Bio.links.map(([text, url]) => (
								<a
									href={url.toString()}
									key={url.toString()}
									lang={lang.get(text)}
								>
									{lang.text(text)}
								</a>
							))}
						</nav>
					) : null}
				</section>
				<section>
					<Timeline />
				</section>
			</main>
		</>
	);
}
