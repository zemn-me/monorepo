"use client";
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

import * as bio from '#root/project/zemn.me/bio/index.js';
import { dividerHeadingClass } from '#root/project/zemn.me/components/DividerHeading/index.js';
import style from '#root/project/zemn.me/components/Glade/style.module.css';
import { HeroVideo } from '#root/project/zemn.me/components/HeroVideo/hero_video.js';
import { TimeEye } from '#root/project/zemn.me/components/TimeEye/index.js';
import ZemnmezLogo from '#root/project/zemn.me/components/ZemnmezLogo/ZemnmezLogo.js';
import { repoFirstCommitYear } from '#root/ts/constants/constants.js';
import * as lang from '#root/ts/react/lang/index.js';

/*
function ZemnmezLogoInline() {
	return <ZemnmezLogo className={style.logoInline} />;
}

function TimeEyeInline() {
	return <TimeEye className={style.logoInline} />;
}
*/

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

export interface GladeProps {
	readonly children?: ReactNode
}

export default function Glade(props: GladeProps) {
	const pathname = usePathname();
	const isHomepage = pathname == "/";
	return (
		<main className={style.main}>
			<HeroVideo className={style.headerBgv}/>
			<header className={style.banner}>
				<LetterHead />
			</header>
			<section className={style.content} >
				{props.children}
			</section>
			<section className={style.footer}>
					<h2 className={dividerHeadingClass}>
						<span>⁂</span>
					</h2>
					<ZemnmezLogo className={style.future} />
					{isHomepage ? <i className={style.tagline}>
						This is what we become, when our eyes are open.
					</i> : null}
					{/* The <small> HTML element represents side-comments and
					small print, like copyright and legal text, independent of
					its styled presentation. By default, it renders text within
					it one font-size smaller, such as from small to x-small.
					*/}
					<small className={style.copyright}
						lang={bio.Bio.who.fullName.language}>
					© {bio.Bio.who.fullName.text} <br /> {repoFirstCommitYear} — {
						(new Date()).getFullYear()
					}
					</small>

			</section>
		</main>
	);
}

