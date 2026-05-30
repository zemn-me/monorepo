'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const analyticsSessionStorageKey = 'ZEMN_ANALYTICS_SESSION_ID';

interface AnalyticsPageBeaconProps {
	readonly apiBase?: string;
}

function dimensions(width: number, height: number) {
	return { width, height };
}

function analyticsSessionId() {
	const stored = window.localStorage.getItem(analyticsSessionStorageKey);
	if (stored) {
		return stored;
	}

	const generated = crypto.randomUUID();
	window.localStorage.setItem(analyticsSessionStorageKey, generated);
	return generated;
}

function collectPage() {
	const params = new URLSearchParams(window.location.search);

	return {
		urlPath: window.location.pathname,
		title: document.title,
		referrer: document.referrer === '' ? undefined : document.referrer,
		utmSource: params.get('utm_source') ?? undefined,
		utmMedium: params.get('utm_medium') ?? undefined,
		utmCampaign: params.get('utm_campaign') ?? undefined,
		utmTerm: params.get('utm_term') ?? undefined,
		utmContent: params.get('utm_content') ?? undefined,
	};
}

function collectContext() {
	return {
		screen: dimensions(window.screen.width, window.screen.height),
		viewport: dimensions(window.innerWidth, window.innerHeight),
		locale: navigator.language,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		userAgent: navigator.userAgent,
	};
}

function collectPerformance() {
	const navigation = performance.getEntriesByType('navigation')[0] as
		| PerformanceNavigationTiming
		| undefined;

	return {
		navigationType: navigation?.type,
		loadMs:
			navigation?.loadEventEnd && navigation.loadEventEnd > 0
				? navigation.loadEventEnd
				: undefined,
	};
}

function collectEngagement() {
	const totalMs = Math.max(0, Math.round(performance.now()));

	return {
		activeMs: document.visibilityState === 'visible' ? totalMs : 0,
		totalMs,
		scrollDepthPercent: Math.min(
			100,
			Math.max(
				0,
				Math.round(
					((window.scrollY + window.innerHeight) /
						Math.max(
							document.documentElement.scrollHeight,
							window.innerHeight
						)) *
						100
				)
			)
		),
		visibilityState: document.visibilityState,
	};
}

export function AnalyticsPageBeacon({
	apiBase = process.env['NEXT_PUBLIC_ZEMN_ME_API_BASE'] ?? 'https://api.zemn.me',
}: AnalyticsPageBeaconProps) {
	const pathname = usePathname();
	const lastSentKey = useRef<string | null>(null);

	useEffect(() => {
		const pageKey = `${pathname}?${window.location.search}`;
		if (lastSentKey.current === pageKey) {
			return;
		}
		lastSentKey.current = pageKey;

		void fetch(`${apiBase}/analytics/beacon`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				eventName: 'page_view',
				eventTime: new Date().toISOString(),
				eventId: crypto.randomUUID(),
				sessionId: analyticsSessionId(),
				context: collectContext(),
				page: collectPage(),
				performance: collectPerformance(),
				engagement: collectEngagement(),
			}),
		});
	}, [apiBase, pathname]);

	return null;
}

