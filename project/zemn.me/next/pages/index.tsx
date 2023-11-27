import Head from 'next/head';
import * as bio from 'project/zemn.me/bio';
import { TimeEye } from 'project/zemn.me/elements/TimeEye';
import ZemnmezLogo from 'project/zemn.me/elements/ZemnmezLogo/ZemnmezLogo';
import * as kenwood from 'project/zemn.me/next/assets/kenwood';
import { dividerHeadingClass } from 'project/zemn.me/next/components/DividerHeading';
import Link from 'project/zemn.me/next/components/Link';
import { Prose } from 'project/zemn.me/next/components/Prose/prose';
import Timeline from 'project/zemn.me/next/components/timeline';
import { RootLayout } from 'project/zemn.me/next/layouts/root/root';
import { NextPageWithLayout } from 'project/zemn.me/next/pages/_app';
import style from 'project/zemn.me/next/pages/index.module.css';
import { ReactElement } from 'react';
import * as lang from 'ts/react/lang';

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

const Page: NextPageWithLayout = function Main() {
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
							I am an internationally recognised expert on
							computer security, with specialisms in web security,
							security program (SSDLC) construction, and automated
							security analysis.
						</p>
						<p>
							I am interested in consulting on legal cases. For
							business, email me at{' '}
							<Link
								href={`mailto:?to=thomas@shadwell.im (${encodeURIComponent(
									bio.Bio.who.fullName.text
								)})`}
							>
								thomas@shadwell.im
							</Link>
							.
						</p>
						<p>
							A selection of my work over the years can be found
							below.
						</p>
					</Prose>
					<>
						{bio.Bio.links !== undefined ? (
							<nav className={style.links}>
								{bio.Bio.links.map(([text, url]) => (
									<Link
										href={url.toString()}
										key={url.toString()}
										lang={lang.get(text)}
									>
										{lang.text(text)}
									</Link>
								))}
							</nav>
						) : null}
					</>
				</header>
				<section>
					<Timeline />
				</section>
				<section className={style.footer}>
					<h2 className={dividerHeadingClass}>
						<span>⁂</span>
					</h2>
					<ZemnmezLogo className={style.future} />
					<i className={style.tagline}>
						This is what we become, when our eyes are open.
					</i>
				</section>
			</section>
		</main>
	);
};

Page.getLayout = function getLayout(content: ReactElement) {
	return <RootLayout noLogo>{content}</RootLayout>;
};

export default Page;
