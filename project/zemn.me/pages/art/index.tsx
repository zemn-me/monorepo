import React from 'react';
import { Route } from 'react-router-dom';

import Logo from '#monorepo/project/zemn.me/pages/art/logo.js';

export default (
	<>
		<Route element={<Logo />} path="logo" />
	</>
);
