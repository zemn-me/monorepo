import classNames from 'classnames';
import * as kenwood from 'project/zemn.me/assets/kenwood';
import { Bio } from 'project/zemn.me/bio';
import { dividerHeadingClass } from 'project/zemn.me/components/DividerHeading';
import style from 'project/zemn.me/components/HeroLayout/HeroLayout.module.css';
import TimeEye from 'project/zemn.me/components/TimeEye';
import ZemnmezLogo from 'project/zemn.me/components/ZemnmezLogo';
import { FC, ReactNode } from 'react';
import { text } from 'ts/react/lang';

export interface FooterProps {
	readonly className?: string;
}

export const Footer: FC<FooterProps> = function Footer(props) {
	return (
		<footer className={classNames(style.footer, props.className)}>
			<h2 className={dividerHeadingClass}>
				<span>⁂</span>
			</h2>
			<ZemnmezLogo className={style.future} />
			<i className={style.tagline}>
				This is what we become, when our eyes are open.
			</i>
		</footer>
	);
};

/**
 * LetterHead is the inner part of the heading with the name and logo.
 */
function LetterHead() {
	return (
		<div className={style.letterHead}>
			<div className={style.handle}>{text(Bio.who.handle)}</div>
			<TimeEye className={style.logo} />
			<div className={style.fullName}>Thomas NJ Shadwell</div>
		</div>
	);
}

export interface Props {
	readonly className?: string;
	readonly children?: ReactNode;
}

export const HeroLayout: FC<Props> = function HeroLayout({ children }) {
	return (
		<main className={style.main}>
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
			<section className={style.content}>{children}</section>
			<Footer />
		</main>
	);
};
