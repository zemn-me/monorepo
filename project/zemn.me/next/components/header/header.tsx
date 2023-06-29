/**
 * @fileoverview on zemn.me this is the top part in 'content' with the eye logo, some links
 * my name etc.
 */

import clsx from 'clsx';
import * as bio from 'project/zemn.me/bio';
import { TimeEye } from 'project/zemn.me/elements/TimeEye';
import style from 'project/zemn.me/next/components/header/header.module.css';
import * as lang from 'ts/react/lang';

export interface HeaderProps {
	className?: string;
}

export default function Header(props: HeaderProps) {
	return (
		<header className={clsx(style.header, props.className)}>
			<TimeEye className={style.logo} />
			<h2 className={style.name}>
				<div
					className={style.realName}
					lang={lang.get(bio.Bio.who.fullName)}
				>
					{lang.text(bio.Bio.who.fullName)}
				</div>
				<div
					className={style.handle}
					lang={lang.get(bio.Bio.who.handle)}
				>
					{lang.text(bio.Bio.who.handle)}
				</div>
			</h2>

			<section className={style.desc}>
				<p>
					I am an internationally recognised international expert on
					computer security, with specialisms in web security,
					security program construction, and automated security
					analysis.
				</p>
				<p>
					I am interested in consulting on legal cases. For business,
					email me at{' '}
					<a href="mailto:thomas@shadwell.im">thomas@shadwell.im</a>.
				</p>
			</section>
			{bio.Bio.links !== undefined ? (
				<nav className={style.links}>
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
		</header>
	);
}
