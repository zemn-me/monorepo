import { expect, jest, test } from "@jest/globals";

import { analyticsBeaconEndpoint, sendAnalyticsBeacon, type AnalyticsEvent } from "./analytics.js";

const baseEvent: AnalyticsEvent = {
	eventName: "page_view",
	eventTime: "2026-03-29T12:34:56.000Z",
	eventId: "evt-123",
	sessionId: "session-456",
};

test("analyticsBeaconEndpoint uses the configured base url", () => {
	expect(analyticsBeaconEndpoint({
		baseUrl: "http://localhost:43123",
	})).toBe("http://localhost:43123/analytics/beacon");
});

test("sendAnalyticsBeacon posts analytics with fetch", async () => {
	const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
		ok: true,
	} as Response);

	await expect(sendAnalyticsBeacon(baseEvent, {
		baseUrl: "http://localhost:43123",
		fetch: fetchMock,
	})).resolves.toBe(true);

	expect(fetchMock).toHaveBeenCalledWith("http://localhost:43123/analytics/beacon", expect.objectContaining({
		method: "POST",
		credentials: "omit",
		keepalive: true,
		headers: {
			"Content-Type": "application/json",
		},
	}));
});

test("sendAnalyticsBeacon returns false without fetch", async () => {
	const originalFetch = globalThis.fetch;
	// @ts-expect-error test-only override
	globalThis.fetch = undefined;

	await expect(sendAnalyticsBeacon(baseEvent, {
		baseUrl: "http://localhost:43123",
	})).resolves.toBe(false);

	globalThis.fetch = originalFetch;
});

test("sendAnalyticsBeacon returns fetch status", async () => {
	const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
		ok: false,
	} as Response);

	await expect(sendAnalyticsBeacon(baseEvent, {
		baseUrl: "http://localhost:43123",
		fetch: fetchMock,
	})).resolves.toBe(false);
});
