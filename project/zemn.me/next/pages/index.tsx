import Head from 'next/head';
import Header from 'project/zemn.me/next/components/header';
import * as bio from 'project/zemn.me/bio';
import * as kenwood from 'project/zemn.me/next/assets/kenwood';
import Timeline from 'project/zemn.me/next/components/timeline';
import style from 'project/zemn.me/next/pages/index.module.css';
import * as lang from 'ts/react/lang';

export default function Main() {
	return (
		<main className={style.main}>
			<Head>
				<title lang={lang.get(bio.Bio.who.handle)}>
					{lang.text(bio.Bio.who.handle)}
				</title>
				<meta
					content="zemn.me git https://github.com/zemnmez/go.git"
					name="go-import"
				/>
			</Head>

			<video
				autoPlay
				className={style.headerBgv}
				loop
				muted
				playsInline
				poster={kenwood.poster.src}
			>
				<kenwood.VideoSources />
			</video>
			<header className={style.banner}>
			</header>
				<section className={style.content}>
					<Header className={style.header}/>
					<section className={style.timeline}>
						<Timeline />
					</section>
				</section>
			</section>
		</main>
	);
}