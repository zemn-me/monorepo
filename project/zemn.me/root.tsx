import React from 'react';
import { BrowserRouter, Routes } from 'react-router-dom';
import Pages from 'monorepo/project/zemn.me/pages';
import NavBar, { Hamburger } from 'monorepo/project/zemn.me/elements/NavBar';
import TitlePage from 'monorepo/project/zemn.me/elements/TitlePage';
import DarkModeSwitcher from 'monorepo/project/zemn.me/elements/DarkModeSwitcher';

// side-effects only.
import './root.module.css';

export const Root: React.FC = () => {
	return (
		<>
			<BrowserRouter>
				<NavBar>
					<Hamburger>
						<DarkModeSwitcher />
					</Hamburger>
				</NavBar>
				<TitlePage />
				<Routes>{Pages}</Routes>
			</BrowserRouter>
		</>
	);
};

export default Root;
