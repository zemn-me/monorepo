import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import style from '#root/project/zemn.me/components/Glade/menu.module.css';
import { InlineLogin } from '#root/project/zemn.me/components/InlineLogin/inline_login.js';
import Link from '#root/project/zemn.me/components/Link/index.js';
import { useIsLoggedIn } from '#root/project/zemn.me/hook/useIsLoggedIn.js';
import { useGetMeScopes } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/zemn.me/hook/useZemnMeAuth.js';

const navLinks = [
	{ href: "/", label: "Home" },
	{ href: "/admin", label: "Admin", requiredScope: "admin_users_manage" },
	{ href: "/admin/users", label: "Users", requiredScope: "admin_users_manage" },
	{ href: "/grievanceportal", label: "Grievance portal", requiredScope: "grievance_portal" },
	{ href: "/key", label: "Key", requiredScope: "callbox_key" },
];

export function GladeMenu() {
	const isLoggedIn = useIsLoggedIn();
	const [fut_idToken] = useZemnMeAuth();
	const fut_scopes = useGetMeScopes(fut_idToken);

	if (!isLoggedIn) return null;

	const isLinkVisible = (requiredScope?: string) =>
		requiredScope === undefined || fut_scopes(
			scopes => scopes.includes(requiredScope),
			() => false,
			() => false
		)

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
					{navLinks.filter(link => isLinkVisible(link.requiredScope)).map(link => (
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
