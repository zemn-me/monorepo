import Art from 'monorepo/project/zemn.me/pages/art/index.js';
import React from 'react';
import { Outlet, Route } from 'react-router-dom';

export const Home: React.FC = () => <>Hello, world!</>;

export const def = (
	<>
		<Route element={<Home />} path="/" />
		<Route element={<Outlet />} path="/art">
			{Art}
		</Route>
	</>
);

export default def;
