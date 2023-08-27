import Head from 'next/head';
import * as bio from 'project/zemn.me/bio';
import { TimeEye } from 'project/zemn.me/elements/TimeEye';
import * as kenwood from 'project/zemn.me/next/assets/kenwood';
import Timeline from 'project/zemn.me/next/components/timeline';
import style from 'project/zemn.me/next/pages/index.module.css';
import * as lang from 'ts/react/lang';

interface ProseProps {
	readonly children?: React.ReactElement[];
}

/**
 * Sets up appropriate padding for showing a bunch of paragraphs.
 */
function Prose(props: ProseProps) {
	return <div className={style.prose}>{props.children}</div>;
}

/**
 * LetterHead is the inner part of the heading with the name and logo.
 */
function LetterHead() {
	return (
		<div className={style.letterHead}>
			<div className={style.handle}>{lang.text(bio.Bio.who.handle)}</div>
			<TimeEye className={style.logo} />
			<div className={style.fullName}>Thomas NJ Shadwell</div>
		</div>
	);
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
				<LetterHead />
			</header>
			<section className={style.content}>
				<header>
					<Prose>
						<p>
							I am an internationally recognised international
							expert on computer security, with specialisms in web
							security, security program construction, and
							automated security analysis.
						</p>
						<p>
							I am interested in consulting on legal cases. For
							business, email me at{' '}
							<a href="mailto:thomas@shadwell.im">
								thomas@shadwell.im
							</a>
							.
						</p>
						<p>
							A selection of my work over the years can be found
							below.
						</p>

						<>
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
						</>
					</Prose>
				</header>
				<section>
					<Timeline />
				</section>
			</section>
		</main>
	);
}
