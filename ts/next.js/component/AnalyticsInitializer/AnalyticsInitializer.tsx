"use client";
import { useEffect, useRef } from 'react';

interface AnalyticsInitializerProps {
	readonly domain: string
}


export function AnalyticsInitializer({domain}: AnalyticsInitializerProps) {

	const initialised = useRef(false);
	useEffect(

		() => {
			if (initialised.current) return;
			initialised.current = true;

			// needed because the module checks location even before init()
			// is called.
			return void import('@plausible-analytics/tracker').then(({init}) => init({domain}))
		}, [domain]

	);

	return null;
}
