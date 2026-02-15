import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import style from '#root/project/zemn.me/components/Glade/menu.module.css';
import { InlineLogin } from '#root/project/zemn.me/components/InlineLogin/inline_login.js';
import Link from '#root/project/zemn.me/components/Link/index.js';
import { useIsLoggedIn } from '#root/project/zemn.me/hook/useIsLoggedIn.js';

const adminLinks = [
	{ href: "/", label: "Home" },
	{ href: "/admin", label: "Admin" },
	{ href: "/grievanceportal", label: "Grievance portal" },
];

export function GladeMenu() {
	const isLoggedIn = useIsLoggedIn();

	if (!isLoggedIn) return null;

	return (
		<nav aria-label="Logged in navigation" className={style.hamburgerNav}>
			<details className={style.hamburgerDetails}>
				<summary aria-label="Open navigation menu" className={style.hamburgerButton}>
					<span className={style.hamburgerIconClosed}>
						<FontAwesomeIcon icon={faBars} />
					</span>
					<span className={style.hamburgerIconOpen}>
						<FontAwesomeIcon icon={faXmark} />
					</span>
				</summary>
				<div className={style.hamburgerMenu}>
					{adminLinks.map(link => (
						<Link
							className={style.hamburgerLink}
							href={link.href}
							key={link.href}
						>
							{link.label}
						</Link>
					))}
					<div className={style.inlineLoginCopy}>
						<InlineLogin />
					</div>
				</div>
			</details>
		</nav>
	);
}
