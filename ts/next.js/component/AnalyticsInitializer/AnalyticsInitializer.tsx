"use client";
import { AnalyticsPageBeacon } from '#root/project/zemn.me/client/analytics.js';

interface AnalyticsInitializerProps {
	readonly domain: string
}

export function AnalyticsInitializer({domain: _domain}: AnalyticsInitializerProps) {
	return <AnalyticsPageBeacon />;
}
