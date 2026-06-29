import { Metadata } from 'next/types';

import {
	imageProps as profilePhoto,
	averageColor as profilePhotoAverageColor,
	pictureSources as profilePhotoSources,
} from '#root/jpeg/2026/05/25/profile_photo.js';
import { Eeg } from '#root/project/me/zemn/app/eeg.js';
import { GladeLayout } from '#root/project/me/zemn/app/glade_layout.js';
import {
	type LinksetLabel,
	LinksetLink,
	type LinksetText,
} from '#root/project/me/zemn/app/linkset_link.js';
import { ProfilePageSchema } from '#root/project/me/zemn/app/schema.js';
import style from '#root/project/me/zemn/app/style.module.css';
import * as bio from '#root/project/me/zemn/bio/index.js';
import * as translations from '#root/project/me/zemn/bio/translations.js';
import { dividerHeadingClass } from '#root/project/me/zemn/components/DividerHeading/index.js';
import Link from '#root/project/me/zemn/components/Link/index.js';
import { Prose } from '#root/project/me/zemn/components/Prose/prose.js';
import { Q } from '#root/project/me/zemn/components/Q/index.js';
import TimeEye from '#root/project/me/zemn/components/TimeEye/TimeEye.js';
import Timeline from '#root/project/me/zemn/components/timeline/index.js';
import ZemnmezLogo from '#root/project/me/zemn/components/ZemnmezLogo/ZemnmezLogo.js';
import { Iterable } from '#root/ts/iter/index.js';
import { None, Some } from '#root/ts/option/option.js';
import * as lang from '#root/ts/react/lang/index.js';
import {
	LocalizedParagraph,
	LocalizedText,
} from '#root/ts/react/lang/LocalizedText.js';

const homepageLinkNames = ['CV', 'linkedin', 'github', 'bluesky', 'twitter'];

function linksetText(text: lang.Text): LinksetText {
	return {
		language: lang.get(text),
		text: lang.text(text),
	};
}

function linksetLabel(caption: bio.LinkCaption): LinksetLabel {
	if ('choices' in caption)
		return {
			choices: caption.choices.map(linksetText),
			defaultText: linksetText(caption.defaultText),
		};

	return linksetText(caption);
}

const homepageLinks = Iterable(bio.Bio.links)
	.map(([caption, url]) =>
		homepageLinkNames.some(n => lang.text(lang.resolveText(caption)) == n)
			? Some({
					label: linksetLabel(caption),
					rel:
						url.origin === bio.Bio.officialWebsite.origin
							? undefined
							: 'me',
					url,
				})
			: None
	)
	.filter()
	.to_array();

function ZemnmezLogoInline() {
	return <ZemnmezLogo className={style.logoInline} />;
}

function TimeEyeInline() {
	return <TimeEye className={style.logoInline} />;
}

export default function Main() {
	return (
		<GladeLayout>
			<Eeg />
			<header>
				<picture
					className={style.profilePhotoFrame}
					style={{ backgroundColor: profilePhotoAverageColor }}
				>
					{profilePhotoSources.map(source => (
						<source key={source.type} {...source} />
					))}
					<img
						alt={lang.text(bio.Bio.who.fullName)}
						className={style.profilePhoto}
						{...profilePhoto}
					/>
				</picture>
				<Prose>
					<LocalizedParagraph>
						{translations.homepage_intro_security}
					</LocalizedParagraph>
					<p>
						<LocalizedText>
							{translations.homepage_intro_openai_prefix}
						</LocalizedText>
						<Link href="https://openai.com">OpenAI</Link>
						<LocalizedText>
							{translations.homepage_intro_openai_suffix}
						</LocalizedText>
					</p>
					<p>
						<LocalizedText>
							{translations.homepage_intro_legal_prefix}
						</LocalizedText>
						<Link
							href={`mailto:?to=thomas@shadwell.im (${encodeURIComponent(
								bio.Bio.who.fullName.text
							)})`}
							rel="me"
						>
							thomas@shadwell.im
						</Link>
						.
					</p>
					<LocalizedParagraph>
						{translations.homepage_intro_selection}
					</LocalizedParagraph>
				</Prose>
				<nav className={style.links}>
					{homepageLinks.map(({ label, rel, url }) => (
						<LinksetLink
							href={url.toString()}
							key={url.toString()}
							label={label}
							rel={rel}
						/>
					))}
				</nav>
			</header>
			<section>
				<Timeline />
			</section>
			<section className={style.about}>
				<h2 className={dividerHeadingClass}>
					<LocalizedText>
						{translations.homepage_about_heading}
					</LocalizedText>
				</h2>
				<Prose>
					<h3 id="website_design">
						<LocalizedText>
							{translations.homepage_about_design_heading}
						</LocalizedText>
					</h3>
					<LocalizedParagraph>
						{translations.homepage_about_design_1}
					</LocalizedParagraph>
					<LocalizedParagraph>
						{translations.homepage_about_design_2}
					</LocalizedParagraph>
					<p>
						<LocalizedText>
							{translations.homepage_about_kenwood_1_prefix}
						</LocalizedText>
						<Link href="https://en.wikipedia.org/wiki/Kenwood_House">
							Kenwood House
						</Link>
						<LocalizedText>
							{translations.homepage_about_kenwood_1_suffix}
						</LocalizedText>
						<Link
							href="https://goo.gl/maps/JEAzn2kZgu6pyaNA6"
							rel="nofollow"
							title="Location of the Kenwood video"
						>
							51.57139601074658°N, -0.16924392259112794°E
						</Link>
						.
					</p>
					<LocalizedParagraph>
						{translations.homepage_about_kenwood_2}
					</LocalizedParagraph>
					<LocalizedParagraph>
						{translations.homepage_about_winter}
					</LocalizedParagraph>
					<p>
						<LocalizedText>
							{translations.homepage_about_type_prefix}
						</LocalizedText>
						<Link href="https://assets.lloyds.com/assets/pdf-lloyds-acts-mar07lloydsact1871/1/pdf-lloyds-acts-Mar07LloydsAct1871.pdf">
							Lloyd's Act 1871
						</Link>
						<LocalizedText>
							{translations.homepage_about_type_suffix}
						</LocalizedText>
					</p>
					<h3 id="logo_disambiguation">
						<LocalizedText>
							{translations.homepage_about_logo_heading_prefix}
						</LocalizedText>
						<ZemnmezLogoInline />
						<LocalizedText>
							{translations.homepage_about_logo_heading_middle}
						</LocalizedText>
						<TimeEyeInline />
						<LocalizedText>
							{translations.homepage_about_logo_heading_suffix}
						</LocalizedText>
					</h3>
					<LocalizedParagraph>
						{translations.homepage_about_logo_1}
					</LocalizedParagraph>
					<LocalizedParagraph>
						{translations.homepage_about_logo_2}
					</LocalizedParagraph>
					<LocalizedParagraph>
						{translations.homepage_about_time_eye_1}
					</LocalizedParagraph>
					<p>
						<LocalizedText>
							{translations.homepage_about_eye_prefix}
						</LocalizedText>
						<Link href="https://en.wikipedia.org/wiki/Eye_of_Providence">
							<Q single>
								<LocalizedText>
									{translations.homepage_about_eye_link}
								</LocalizedText>
							</Q>
						</Link>
						<LocalizedText>
							{translations.homepage_about_eye_suffix}
						</LocalizedText>
					</p>
					<LocalizedParagraph>
						{translations.homepage_about_identity}
					</LocalizedParagraph>
				</Prose>
			</section>

			<script
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(ProfilePageSchema),
				}}
				type="application/ld+json"
			/>
		</GladeLayout>
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
