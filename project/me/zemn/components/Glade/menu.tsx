import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef } from 'react';

import style from '#root/project/me/zemn/components/Glade/menu.module.css';
import { InlineLogin } from '#root/project/me/zemn/components/InlineLogin/inline_login.js';
import Link from '#root/project/me/zemn/components/Link/index.js';
import { useGetMeScopes } from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
import { navSections } from '#root/project/me/zemn/navigation/navigation.js';

export function GladeMenu() {
	const detailsRef = useRef<HTMLDetailsElement | null>(null);
	const [fut_idToken] = useZemnMeAuth();
	const fut_scopes = useGetMeScopes(fut_idToken);
	const isLoggedIn = fut_idToken(
		() => true,
		() => false,
		() => false
	);

	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			const details = detailsRef.current;
			if (!(event.target instanceof Node) || !details?.open) {
				return;
			}

			if (!details.contains(event.target)) {
				details.open = false;
			}
		};

		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	}, []);

	const isLinkVisible = (requiredScope?: string) =>
		requiredScope === undefined ||
		fut_scopes(
			scopes => scopes.includes(requiredScope),
			() => false,
			() => false
		);

	return (
		<nav aria-label="Site navigation" className={style.hamburgerNav}>
			<details className={style.hamburgerDetails} ref={detailsRef}>
				<summary
					aria-label="Open navigation menu"
					className={style.hamburgerButton}
				>
					<span className={style.hamburgerIconClosed}>
						<FontAwesomeIcon icon={faBars} />
					</span>
					<span className={style.hamburgerIconOpen}>
						<FontAwesomeIcon icon={faXmark} />
					</span>
				</summary>
				<div className={style.hamburgerMenu}>
					{navSections.map(section =>
						section((label, links) => {
							const visibleLinks = links.filter(link =>
								link(
									(
										_href,
										_label,
										_description,
										requiresAuthentication,
										requiredScope
									) =>
										(!requiresAuthentication ||
											isLoggedIn) &&
										isLinkVisible(requiredScope)
								)
							);
							if (visibleLinks.length === 0) return null;
							return (
								<section
									aria-label={label}
									className={style.hamburgerSection}
									key={label}
								>
									<h2 className={style.hamburgerSectionLabel}>
										{label}
									</h2>
									<div className={style.hamburgerLinks}>
										{visibleLinks.map(link =>
											link((href, label) => (
												<Link
													className={
														style.hamburgerLink
													}
													href={href}
													key={href}
												>
													{label}
												</Link>
											))
										)}
									</div>
								</section>
							);
						})
					)}
					<div className={style.inlineLoginCopy}>
						<InlineLogin />
					</div>
				</div>
			</details>
		</nav>
	);
}
