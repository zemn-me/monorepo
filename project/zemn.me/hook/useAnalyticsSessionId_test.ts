import { expect, jest, test } from "@jest/globals";
import { QueryClient } from "@tanstack/react-query";

import { ANALYTICS_SESSION_ID_QUERY_KEY } from "./useAnalyticsSessionId.js";

test("analytics session id query is stable and never stale", async () => {
	const client = new QueryClient();

	const first = await client.fetchQuery({
		queryKey: ANALYTICS_SESSION_ID_QUERY_KEY,
		queryFn: () => "00000000-0000-4000-8000-000000000001",
		staleTime: Infinity,
		gcTime: Infinity,
	});
	const second = await client.fetchQuery({
		queryKey: ANALYTICS_SESSION_ID_QUERY_KEY,
		queryFn: () => crypto.randomUUID(),
		staleTime: Infinity,
		gcTime: Infinity,
	});
	const query = client.getQueryCache().find({ queryKey: ANALYTICS_SESSION_ID_QUERY_KEY });

	expect(first).toBe("00000000-0000-4000-8000-000000000001");
	expect(second).toBe(first);
	expect(query?.options.staleTime).toBe(Infinity);
	expect(query?.options.gcTime).toBe(Infinity);
});
