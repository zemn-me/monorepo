// side-effects only.
import './root.module.css';

import DarkModeSwitcher from 'project/zemn.me/elements/DarkModeSwitcher';
import NavBar, { Hamburger } from 'project/zemn.me/elements/NavBar';
import TitlePage from 'project/zemn.me/elements/TitlePage';
import Pages from 'project/zemn.me/pages';
import React from 'react';
import { BrowserRouter, Routes } from 'react-router-dom';

export const Root: React.FC = () => (
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

export default Root;
