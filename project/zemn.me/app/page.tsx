import { Metadata } from 'next/types';

import { Eeg } from '#root/project/zemn.me/app/eeg.js';
import style from '#root/project/zemn.me/app/style.module.css';
import * as kenwood from '#root/project/zemn.me/assets/kenwood/index.js';
import * as kenwood_snow from '#root/project/zemn.me/assets/kenwood_snow/kenwood_snow.js';
import * as bio from '#root/project/zemn.me/bio/index.js';
import { dividerHeadingClass } from '#root/project/zemn.me/components/DividerHeading/index.js';
import Link from '#root/project/zemn.me/components/Link/index.js';
import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';
import { TimeEye } from '#root/project/zemn.me/components/TimeEye/index.js';
import Timeline from '#root/project/zemn.me/components/timeline/index.js';
import ZemnmezLogo from '#root/project/zemn.me/components/ZemnmezLogo/ZemnmezLogo.js';
import * as lang from '#root/ts/react/lang/index.js';
import About from 'project/zemn.me/app/about';



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

/**
 * In the Northern Hemisphere it is commonly regarded as extending from the winter
 * solstice (year's shortest day), December 21 or 22, to the vernal equinox (day and
 * night equal in length), March 20 or 21, and in the Southern Hemisphere from June
 * 21 or 22 to September 22 or 23.
 */
function isWinter(v: Date): boolean {
	const month = v.getMonth();
	return month >= 11 || month <= 1;
}

export default function Main() {
	const currentlyWinter = isWinter(new Date());
	return (
		<main className={style.main}>
			<Eeg />
			<video
				autoPlay
				className={style.headerBgv}
				loop
				muted
				playsInline
				poster={
					(currentlyWinter ? kenwood_snow.poster : kenwood.poster).src
				}
			>
				{currentlyWinter ? (
					<kenwood_snow.VideoSources />
				) : (
					<kenwood.VideoSources />
				)}
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
							I am a Member of Technical Staff at{' '}
							<Link href="https://openai.com">OpenAI</Link>, where
							I work on computer security.
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
				</header>
				<section>
					<Timeline />
				</section>
				<section className={style.about}>
					<h2 className={dividerHeadingClass}>
						<span lang="en-GB">About.</span>
					</h2>
					<Prose lang="en-GB"><About/></Prose>
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
}

const title = `${lang.text(bio.Bio.who.firstName)} ${lang.text(bio.Bio.who.lastName)} | ${lang.text(bio.Bio.who.handle)}`;
const description = `Personal website and profile of ${lang.text(bio.Bio.who.fullName)}, also known as ${lang.text(bio.Bio.who.handle)}.`;
export const metadata: Metadata = {
	title,
	description,
	openGraph: {
		title,
		description,
		type: 'profile',
		emails: 'thomas@shadwell.im',
		firstName: lang.text(bio.Bio.who.firstName),
		lastName: lang.text(bio.Bio.who.lastName),
		username: lang.text(bio.Bio.who.handle),
	},
	twitter: {
		title,
		description,
	},
};
