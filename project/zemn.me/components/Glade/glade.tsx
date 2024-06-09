
import { ReactNode } from 'react';

import * as bio from '#root/project/zemn.me/bio/index.js';
import style from '#root/project/zemn.me/components/Glade/style.module.css';
import { HeroVideo } from '#root/project/zemn.me/components/HeroVideo/hero_video.js';
import { TimeEye } from '#root/project/zemn.me/components/TimeEye/index.js';
import * as lang from '#root/ts/react/lang/index.js';

/*
import ZemnmezLogo from '#root/project/zemn.me/components/ZemnmezLogo/ZemnmezLogo.js';

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
	return (
		<main className={style.main}>
			<HeroVideo className={style.headerBgv}/>
			<header className={style.banner}>
				<LetterHead />
			</header>
			<section className={style.content} >
				{props.children}
			</section>
		</main>
	);
}

