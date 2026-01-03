"use client";
import { init } from '@plausible-analytics/tracker';
import { useEffect } from 'react';

type maybeWindow = { location?: { host?: string } } | undefined;

export function AnalyticsInitializer() {

	const domain = (window as maybeWindow)?.location?.host;
	useEffect(

		() => domain === undefined
			? domain
			: init({domain}), [domain]

	);

	return null;
}
