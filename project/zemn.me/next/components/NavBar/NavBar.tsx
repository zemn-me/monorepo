import classNames from 'classnames';
import ZemnmezLogo from 'project/zemn.me/elements/ZemnmezLogo/ZemnmezLogo';
import style from 'project/zemn.me/next/components/NavBar/index.module.css';
import { ReactNode } from 'react';

export interface Props {
	readonly noLogo?: boolean;
	readonly className?: string;
}

export function NavBar(props: Props) {
	return (
		<nav className={classNames(style.NavBar)}>
			{props.noLogo ? null : <ZemnmezLogo className={style.logo} />}
		</nav>
	);
}

export interface DefaultLayoutProps {
	readonly children?: ReactNode;
	readonly noLogo?: boolean;
}

export function DefaultLayout(props: DefaultLayoutProps) {
	return (
		<div className={style.DefaultLayout}>
			<NavBar noLogo={props.noLogo} />
			<div className={style.content}>{props.children}</div>
		</div>
	);
}
