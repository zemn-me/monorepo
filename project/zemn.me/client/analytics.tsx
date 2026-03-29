"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import type { paths } from "#root/project/zemn.me/api/api_client.gen.js";
import { publicFetchClient } from "#root/project/zemn.me/client/client.js";
import { useAnalyticsSessionId } from "#root/project/zemn.me/client/useAnalyticsSessionId.js";

export type AnalyticsEvent = paths["/analytics/beacon"]["post"]["requestBody"]["content"]["application/json"];

export async function sendAnalyticsBeacon(event: AnalyticsEvent): Promise<boolean> {
	const response = await publicFetchClient.POST("/analytics/beacon", {
		body: event,
		credentials: "omit",
		keepalive: true,
		headers: {
			"Content-Type": "application/json",
		},
	});

	return response.response.ok;
}

function collectDimensions(width: number, height: number) {
	return { width, height };
}

function collectPage(pathname: string, searchParams: URLSearchParams) {
	return {
		urlPath: pathname,
		title: document.title,
		referrer: document.referrer === '' ? undefined : document.referrer,
		utmSource: searchParams.get('utm_source') ?? undefined,
		utmMedium: searchParams.get('utm_medium') ?? undefined,
		utmCampaign: searchParams.get('utm_campaign') ?? undefined,
		utmTerm: searchParams.get('utm_term') ?? undefined,
		utmContent: searchParams.get('utm_content') ?? undefined,
	};
}

function collectContext() {
	return {
		screen: collectDimensions(window.screen.width, window.screen.height),
		viewport: collectDimensions(window.innerWidth, window.innerHeight),
		locale: navigator.language,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		userAgent: navigator.userAgent,
	};
}

function collectPerformance() {
	const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

	return {
		navigationType: navigation?.type,
		loadMs: navigation?.loadEventEnd && navigation.loadEventEnd > 0 ? navigation.loadEventEnd : undefined,
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
					((window.scrollY + window.innerHeight)
						/ Math.max(document.documentElement.scrollHeight, window.innerHeight))
						* 100,
				),
			),
		),
		visibilityState: document.visibilityState,
	};
}

export function AnalyticsPageBeacon() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const lastSentKey = useRef<string | null>(null);
	const sessionIdQuery = useAnalyticsSessionId();

	useEffect(() => {
		if (sessionIdQuery.data === undefined) {
			return;
		}

		const search = searchParams.toString();
		const pageKey = search === '' ? pathname : `${pathname}?${search}`;
		if (lastSentKey.current === pageKey) {
			return;
		}
		lastSentKey.current = pageKey;

		void sendAnalyticsBeacon({
			eventName: 'page_view',
			eventTime: new Date().toISOString(),
			eventId: crypto.randomUUID(),
			sessionId: sessionIdQuery.data,
			context: collectContext(),
			page: collectPage(pathname, searchParams),
			performance: collectPerformance(),
			engagement: collectEngagement(),
		});
	}, [pathname, searchParams, sessionIdQuery.data]);

	return null;
}
