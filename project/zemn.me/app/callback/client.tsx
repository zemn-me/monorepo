'use client';

import { useEffect } from 'react';

function postBackToOpener() {
	const payload = {
		type: 'window-callback' as const,
		href: window.location.href,
	};

	const opener = window.opener;

	if (window.opener === null)
		throw new Error("missing opener 😭");

	opener.postMessage(payload, location.origin);
	opener.focus();
	window.close();
}

export default function Callback() {
	useEffect(() => {
		postBackToOpener();

		return () => {
			/* no-op */
		};
	}, []);

	return (
		<main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
			<p>Authentication complete. You may close this window.</p>
		</main>
	);
}
