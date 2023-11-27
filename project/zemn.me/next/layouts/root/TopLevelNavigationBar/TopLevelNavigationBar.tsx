import TimeEye from 'project/zemn.me/elements/TimeEye';
import Link from 'project/zemn.me/next/components/Link';
import style from 'project/zemn.me/next/layouts/root/TopLevelNavigationBar/style.module.css';

export interface Props {
	readonly noLogo?: boolean;
}

export function TopLevelNavigationBar({ noLogo }: Props) {
	return (
		<nav className={style.bar}>
			{noLogo ? null : (
				<Link className={style.timeEye} href="/">
					<TimeEye className={style.timeEye} />
				</Link>
			)}
			<div className={style.links}>
				<Link href="/about">About</Link>
				<Link href="/experiments">Experiments</Link>
			</div>
		</nav>
	);
}
