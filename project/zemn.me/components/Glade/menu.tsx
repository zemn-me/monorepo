import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import style from '#root/project/zemn.me/components/Glade/menu.module.css';
import { InlineLogin } from '#root/project/zemn.me/components/InlineLogin/inline_login.js';
import Link from '#root/project/zemn.me/components/Link/index.js';
import { useIsLoggedIn } from '#root/project/zemn.me/hook/useIsLoggedIn.js';
import { useGetMeScopes } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/zemn.me/hook/useZemnMeAuth.js';
import { future_to_option } from '#root/ts/future/option/future_to_option.js';
import { unwrap_or as option_unwrap_or } from '#root/ts/option/types.js';

const navLinks = [
	{ href: "/", label: "Home" },
	{ href: "/admin", label: "Admin", requiredScope: "admin_users_manage" },
	{ href: "/admin/users", label: "Users", requiredScope: "admin_users_manage" },
	{ href: "/grievanceportal", label: "Grievance portal", requiredScope: "grievance_portal" },
];

export function GladeMenu() {
	const isLoggedIn = useIsLoggedIn();
	const [fut_idToken] = useZemnMeAuth();
	const idToken = option_unwrap_or(future_to_option(fut_idToken), "");
	const scopesQuery = useGetMeScopes(idToken);
	const scopes = scopesQuery.data ?? [];

	if (!isLoggedIn) return null;

	const isLinkVisible = (requiredScope?: string) =>
		requiredScope === undefined || scopes.includes(requiredScope);

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
