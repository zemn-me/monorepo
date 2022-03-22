import { Route } from 'react-router-dom';
import Logo from './logo';
import React from 'react';

export const Self = (
	<>
		<Route path="logo" element={<Logo />} />
	</>
);

export default Self;
