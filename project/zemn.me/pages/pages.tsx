import { Route, Outlet } from 'react-router-dom';
import React from 'react';
import Art from 'project/zemn.me/pages/art';

export const Home: React.FC = () => <>Hello, world!</>;

export const def = (
	<>
		<Route path="/" element={<Home />} />
		<Route path="/art" element={<Outlet />}>
			{Art}
		</Route>
	</>
);

export default def;
