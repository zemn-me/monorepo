import { Outlet, Route } from 'react-router-dom';
import React from 'react';
import Art from 'monorepo/project/zemn.me/pages/art';

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
