import type { components } from "#root/project/zemn.me/api/api_client.gen.js";
import { ZEMN_ME_API_BASE } from "#root/project/zemn.me/constants/constants.js";

export type AnalyticsEvent = components["schemas"]["AnalyticsEvent"];

export interface SendAnalyticsBeaconOptions {
	baseUrl?: string | URL;
	endpoint?: string | URL;
	fetch?: typeof fetch;
}

const ANALYTICS_PATH = "/analytics/beacon";

function toUrlString(value: string | URL): string {
	return value instanceof URL ? value.toString() : value;
}

export function analyticsBeaconEndpoint(options: Pick<SendAnalyticsBeaconOptions, "baseUrl" | "endpoint"> = {}): string {
	if (options.endpoint !== undefined) {
		return toUrlString(options.endpoint);
	}

	return new URL(ANALYTICS_PATH, toUrlString(options.baseUrl ?? ZEMN_ME_API_BASE)).toString();
}

export async function sendAnalyticsBeacon(
	event: AnalyticsEvent,
	options: SendAnalyticsBeaconOptions = {},
): Promise<boolean> {
	const endpoint = analyticsBeaconEndpoint(options);
	const payload = JSON.stringify(event);

	const send = options.fetch ?? globalThis.fetch;
	if (send === undefined) {
		return false;
	}

	const response = await send(endpoint, {
		method: "POST",
		body: payload,
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "omit",
		keepalive: true,
	});

	return response.ok;
}
