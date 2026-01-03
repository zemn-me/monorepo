"use client";
import { init } from '@plausible-analytics/tracker';
import { useEffect } from 'react';

export function AnalyticsInitializer() {
	const domain = window.location.host;
	useEffect(
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		() => domain === undefined
			? domain
			: init({domain}), [domain]

	);

	return null;
}
