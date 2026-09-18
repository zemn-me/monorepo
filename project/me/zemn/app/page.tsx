import { Metadata } from 'next/types';

import {
	imageProps as profilePhoto,
	averageColor as profilePhotoAverageColor,
	pictureSources as profilePhotoSources,
} from '#root/jpeg/2026/05/25/profile_photo.js';
import { Eeg } from '#root/project/me/zemn/app/eeg.js';
import {
	type LinksetLabel,
	LinksetLink,
	type LinksetText,
} from '#root/project/me/zemn/app/linkset_link.js';
import { ProfilePageSchema } from '#root/project/me/zemn/app/schema.js';
import style from '#root/project/me/zemn/app/style.module.css';
import * as bio from '#root/project/me/zemn/bio/index.js';
import Link from '#root/project/me/zemn/components/Link/index.js';
import { Prose } from '#root/project/me/zemn/components/Prose/prose.js';
import Timeline from '#root/project/me/zemn/components/timeline/index.js';
import { Iterable } from '#root/ts/iter/index.js';
import { None, Some } from '#root/ts/option/option.js';
import * as lang from '#root/ts/react/lang/index.js';

const homepageLinkNames = ['CV', 'linkedin', 'github', 'bluesky', 'twitter'];

function linksetText(text: lang.Text): LinksetText {
	return {
		language: lang.get(text),
		text: lang.text(text),
	};
}

function linksetLabel(caption: bio.LinkCaption): LinksetLabel {
	if (caption instanceof lang.TextType) return linksetText(caption);

	return {
		choices: caption.choices.map(linksetText),
		defaultText: linksetText(caption.defaultText),
	};
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

export default function Main() {
	return (
		<>
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
					<p>
						I am an internationally recognised expert on computer
						security, with specialisms in web security, security
						program (SSDLC) construction, and automated security
						analysis.
					</p>
					<p>
						I am a Member of Technical Staff at{' '}
						<Link href="https://openai.com">OpenAI</Link>, where I
						work on computer security.
					</p>
					<p>
						I am interested in consulting on legal cases. For
						business, email me at{' '}
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
					<p>
						A selection of my work over the years can be found
						below.
					</p>
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

			<script
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(ProfilePageSchema),
				}}
				type="application/ld+json"
			/>
		</>
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
