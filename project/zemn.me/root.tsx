import React from 'react';
import { BrowserRouter, Routes } from 'react-router-dom';
import Pages from 'project/zemn.me/pages';
import NavBar from 'project/zemn.me/elements/NavBar';

// side-effects only.
import './root.module.css';

export const Root: React.FC = () => (
	<>
		<BrowserRouter>
			<NavBar />
			<Routes>{Pages}</Routes>
		</BrowserRouter>
	</>
);

export default Root;
