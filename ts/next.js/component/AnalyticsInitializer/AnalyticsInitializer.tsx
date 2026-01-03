"use client";
import { init } from '@plausible-analytics/tracker';
import { useEffect } from 'react';

export function AnalyticsInitializer() {
	useEffect(
		() => init({ domain: location.host }), []
	);

	return null;
}
