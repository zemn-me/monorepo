import Head from 'next/head';
import * as bio from 'project/zemn.me/bio';
import { TimeEye } from 'project/zemn.me/elements/TimeEye';
import * as kenwood from 'project/zemn.me/next/assets/kenwood';
import Timeline from 'project/zemn.me/next/components/timeline';
import style from 'project/zemn.me/next/pages/index.module.css';
import * as lang from 'ts/react/lang';

/**
 * LetterHead is the inner part of the heading with the name and logo.
 */
function LetterHead() {
	return <div className={style.letterHead}>
		<div className={style.handle}>{lang.text(bio.Bio.who.handle)}</div>
		<TimeEye className={style.logo}/>
		<div className={style.fullName}>Thomas NJ Shadwell</div>
	</div>
}

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
				<LetterHead/>
			</header>
			<section className={style.content}>
				<header>
					<h2 lang={lang.get(bio.Bio.who.fullName)}>
						{lang.text(bio.Bio.who.fullName)}
					</h2>
					<p>
						I am an internationally recognised international expert
						on computer security, with specialisms in web security,
						security program construction, and automated security
						analysis.
					</p>
					<p>
						I am interested in consulting on legal cases. For
						business, email me at{' '}
						<a href="mailto:thomas@shadwell.im">
							thomas@shadwell.im
						</a>
						.
					</p>
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
				<section>
					<Timeline />
				</section>
			</section>
		</main>
	);
}
