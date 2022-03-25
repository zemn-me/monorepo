import React from 'react';
import { BrowserRouter, Routes } from 'react-router-dom';
import Pages from 'project/zemn.me/pages';
import NavBar, { Hamburger } from 'project/zemn.me/elements/NavBar';
import TitlePage from 'project/zemn.me/elements/TitlePage';
import DarkModeSwitcher from 'project/zemn.me/elements/DarkModeSwitcher';

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
