import classNames from 'classnames';
import ZemnmezLogo from 'project/zemn.me/elements/ZemnmezLogo/ZemnmezLogo';
import Link from 'project/zemn.me/next/components/Link';
import { MultiLevelMenu } from 'project/zemn.me/next/components/MultiTierMenu/MultiTierMenu';
import style from 'project/zemn.me/next/components/NavBar/index.module.css';
import { ReactNode } from 'react';

export interface Props {
	readonly noLogo?: boolean;
	readonly className?: string;
}

export function NavBar(props: Props) {
	return (
		<>
			<nav className={classNames(style.NavBar)}>
				{props.noLogo ? null : (
					<Link className={style.logo} href="/">
						<ZemnmezLogo className={style.logo} />
					</Link>
				)}
				<MultiLevelMenu className={style.menu} />
			</nav>
		</>
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
