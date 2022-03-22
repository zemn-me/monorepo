import React from 'react';
import { BrowserRouter, Routes } from 'react-router-dom';
import Pages from 'project/zemn.me/pages';

export const Root: React.FC = () => (
	<>
		<BrowserRouter>
			<Routes>{Pages}</Routes>
		</BrowserRouter>
	</>
);

export default Root;
