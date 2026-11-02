'use client';

import { useEffect } from 'react';

export default function Page() {
	useEffect(() => {
		const destination = new URL(
			'/experiments/elastictabs',
			window.location.origin
		);
		destination.search = window.location.search;
		destination.hash = window.location.hash;
		window.location.replace(destination);
	}, []);

	return null;
}
