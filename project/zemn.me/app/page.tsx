import { Metadata } from 'next/types';

import { Eeg } from '#root/project/zemn.me/app/eeg.js';
import style from '#root/project/zemn.me/app/style.module.css';
import * as kenwood from '#root/project/zemn.me/assets/kenwood/index.js';
import * as bio from '#root/project/zemn.me/bio/index.js';
import { dividerHeadingClass } from '#root/project/zemn.me/components/DividerHeading/index.js';
import Link from '#root/project/zemn.me/components/Link/index.js';
import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';
import { Q } from '#root/project/zemn.me/components/Q/index.js';
import { TimeEye } from '#root/project/zemn.me/components/TimeEye/index.js';
import Timeline from '#root/project/zemn.me/components/timeline/index.js';
import ZemnmezLogo from '#root/project/zemn.me/components/ZemnmezLogo/ZemnmezLogo.js';
import * as lang from '#root/ts/react/lang/index.js';
import * as kenwood_snow from '#root/project/zemn.me/assets/kenwood_snow/kenwood_snow.js';

function ZemnmezLogoInline() {
	return <ZemnmezLogo className={style.logoInline} />;
}

function TimeEyeInline() {
	return <TimeEye className={style.logoInline} />;
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
					<Prose lang="en-GB">
						<h3 id="website_design">The design of this website.</h3>
						<p>
							This website is a direct descendant of one I made in
							2019. The core ideas come from very early on when I
							was using the internet, and I didn't want to tell
							people with my chosen username what kind of person I
							was. I picked the username <Q single>zemnmez</Q> to
							be something meaningless that people could fill with
							their own ideas of who I was.
						</p>
						<p>
							Similarly, when I made the website, I didn't want to
							tell people directly about myself, so instead I made
							this timeline to keep track of what I had done every
							year. The number in roman numerals is my age that
							year. It fulfilled another role as I was collecting
							my work to apply for my US O1 visa, which requires
							proving that you've done a lot of interesting
							things!
						</p>
						<p>
							The background video (<Q single>hero video</Q>) in
							summer is of a hidden area in the gardens of{' '}
							<Link href="https://en.wikipedia.org/wiki/Kenwood_House">
								Kenwood House
							</Link>
							, a beautiful stately home sandwiched between
							Highgate and Hampstead in London where I grew up.
							It's located at about{' '}
							<Link
								href="https://goo.gl/maps/JEAzn2kZgu6pyaNA6"
								rel="nofollow"
								title="Location of the Kenwood video"
							>
								51.57139601074658°N, -0.16924392259112794°E
							</Link>
							.
						</p>
						<p>
							It used to be that there was a bench hidden under
							overgrown bushes and a tree near the hydrangeas past
							the orangery. I took a video from there one summer –
							I was collecting photos and videos to remind me of
							home because I knew I'd leave it behind someday to
							move to the US.
						</p>
						<p>
							In winter, a close-by location of Kenwood House in
							the snow is shown.
						</p>
						<p>
							The type and style itself was inspired by older,
							pre-computer era typsetting such as the{' '}
							<Link href="https://assets.lloyds.com/assets/pdf-lloyds-acts-mar07lloydsact1871/1/pdf-lloyds-acts-Mar07LloydsAct1871.pdf">
								Lloyd's Act 1871
							</Link>
							. Particular effort was put into trying to have
							content fill horizontal space automatically, as seen
							in older documents that try to make the most of the
							paper they're printed on.
						</p>
						<h3 id="logo_disambiguation">
							What's the difference between <ZemnmezLogoInline />{' '}
							and <TimeEyeInline />?
						</h3>
						<p>
							The diamond logo (<ZemnmezLogoInline />) came out of
							several years of wanting a way to express myself in
							art. For a few years following, I changed logo
							annually based how I'd felt the year prior, making
							logos with geometry and construction lines.
						</p>
						<p>
							When I eventually made the diamond logo, it ended up
							looking a like an eye logo I'd made very early on in
							2012. I liked it so much it came to represent the
							persona I had since 2009. The logo itself is from
							much later, probably around 2015.
						</p>
						<p>
							The time eye logo (<TimeEyeInline />) was the later
							(2019) creation, coming out of a specific need to
							disambiguate between the published work I had as{' '}
							<Q single>Thomas Shadwell</Q>, my real name, versus{' '}
							<Q single>zemnmez</Q>, the persona I had used since
							2009. It became necessary after I made the Forbes
							Under 30 list for my tax system hack in 2018. Before
							this point I'd worked hard to try to keep the two
							identities separate, but Forbes lists aren't really
							for online personas.
						</p>
						<p>
							The eye logo is a reference to the well-known{' '}
							<Link href="https://en.wikipedia.org/wiki/Eye_of_Providence">
								<Q single>eye of providence</Q>
							</Link>
							, a symbol that represents human achievement as
							being incomplete without God. I wanted it to reflect
							the idea that, in a universe that might not have a
							God, we as people have a responsibility to care for
							each other.
						</p>
						<p>
							In having to make this distinction, for a short time
							the work published as <Q single>zemnmez</Q>{' '}
							continued to represent the things I was most proud
							of – an idealised kind of self. But at Google, I
							started to publish security research I was really
							proud of as both <Q single>zemnmez</Q> and{' '}
							<Q single>Thomas Shadwell</Q> The abstract ideas are
							still there, but now I'm more <Q single>Thomas</Q>{' '}
							than I ever was. ☺
						</p>
					</Prose>
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
