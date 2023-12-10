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
 */
import Link from 'next/link';
import style from 'project/zemn.me/next/components/MultiTierMenu/index.module.css';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

export interface MenuPageProps {
	readonly name: string;
	readonly children?: React.ReactNode;
}

export function MenuPage(props: MenuPageProps) {
	return <Route element={props.children} path={props.name} />;
}

export function MultiLevelMenu() {
	return (
		<MemoryRouter>
			<Routes>
				<MenuPage name="experiments">
					<Link href="/experiments/rays">rays thing</Link>
				</MenuPage>
			</Routes>
		</MemoryRouter>
	);
}
