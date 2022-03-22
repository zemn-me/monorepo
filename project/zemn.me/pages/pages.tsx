import { Route } from 'react-router-dom';
import React from 'react';

export const Home: React.FC = () => <>Hello, world!</>;

export const def = (
	<>
		<Route path="/" element={<Home />} />
	</>
);

export default def;
