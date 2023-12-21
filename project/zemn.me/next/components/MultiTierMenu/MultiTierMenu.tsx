/**
 * @fileoverview implements an apple.com
 * style multi level menu
 *
 * The core concept of this menu is to have
 * what is essentially a navigation tree
 *
 * Experiments -> Something
 *             -> Something Else
 * 			   -> Extra cool      -> Some other thing
 * 								  -> Also a thing
 *
 * About	   -> About me
 * 			   -> About something else
 *
 * Because this menu is going to be on every page, we won't
 * be able to use the typical next.js router.
 *
 * General idea is to implement this by having a react-router
 * <MemoryRouter> that contains the state of the menu.
 */
import GlobalLink from 'next/link';
import style from 'project/zemn.me/next/components/MultiTierMenu/index.module.css';
import {
	Link,
	MemoryRouter,
	Outlet,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from 'react-router-dom';

interface BackButtonProps {
	readonly className?: string;
}

function BackButton(props: BackButtonProps) {
	const navigate = useNavigate();
	const location = useLocation();
	if (location.pathname != '/')
		return (
			<a className={props.className} onClick={() => navigate(-1)}>
				&lt;
			</a>
		);
}

export interface MenuPageProps {
	readonly children?: React.ReactNode;
}

export function MenuPage(props: MenuPageProps) {
	return <>{props.children}</>;
}

function PathName() {
	return useLocation().pathname;
}

export interface Props {
	readonly className?: string;
}

export function MultiLevelMenu(props: Props) {
	return (
		<div className={props.className}>
			<MemoryRouter>
				<Routes>
					<Route
						element={
							<div className={style.menuPage}>
								<BackButton className={style.backButton} />
								<div className={style.path}>
									<PathName />
								</div>
								<Outlet />
							</div>
						}
						path="/"
					>
						<Route
							element={
								<MenuPage>
									<Link to="/experiments">experiments</Link>
									<Link to="/etc">etc</Link>
								</MenuPage>
							}
							index
						/>
						<Route
							element={
								<MenuPage>
									<GlobalLink href="/experiments/emoji/flag">
										emoji thing
									</GlobalLink>

									<GlobalLink href="/experiments/rays">
										rays
									</GlobalLink>
								</MenuPage>
							}
							path="experiments"
						/>
						<Route
							element={
								<MenuPage>
									<GlobalLink href="/.well_known/security.txt">
										security.txt
									</GlobalLink>
								</MenuPage>
							}
							path="etc"
						/>
					</Route>
				</Routes>
			</MemoryRouter>
		</div>
	);
}
