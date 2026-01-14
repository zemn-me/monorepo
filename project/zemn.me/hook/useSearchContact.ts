import { skipToken, useQuery } from "@tanstack/react-query";
import parsePhoneNumber from "libphonenumber-js";
import createFetchClient from "openapi-fetch";

import { useGoogleAuth } from "#root/project/zemn.me/hook/useGoogleAuth.js";
import type { components, paths } from "#root/third_party/com/googleapis/people/api_client.gen.js";
import { PeopleFieldMask } from "#root/ts/google/people/display.js";
import * as option from "#root/ts/option/types.js";
import { Minute } from "#root/ts/time/duration.js";

export type Person = components["schemas"]["Person"];

// google contacts uses an absolutely mad non-spec canonical form
// for searching contacts (assumedly andriod is NOT using this API).
export function normalizePhoneNumberQuery(
	query: string
): string {
	const pn = parsePhoneNumber(query);

	if (pn === undefined) return query // as-is

	if (pn.country === 'US') return pn.formatInternational();

	// yes, seriously?
	return pn.formatInternational().replace(/ /g, "");
}

export interface ContactSearchOptions {
	readonly normalizeQuery?: (query: string) => string;
}

export function useSearchContact(
	query: string | undefined,
	readMask: Set<PeopleFieldMask>,
	options: ContactSearchOptions = {}
) {
	const normalizeQuery = options.normalizeQuery ?? normalizePhoneNumberQuery;
	const normalized_query =
		query ?
			normalizeQuery(query)
			// intentionally an empty string due to recommendation
			// from Google to warm up cache.
			: "";
	const [, access_token] = useGoogleAuth([]);
	const read_mask = [...readMask].join(",");

	return useQuery({
		queryKey: ["contacts-search", normalized_query, read_mask],
		staleTime: 2 * Minute,
		queryFn: option.is_some(access_token)
			? async () => createFetchClient<paths>({
				baseUrl: "https://people.googleapis.com",
				headers: {
					Authorization: `Bearer ${option.unwrap_unchecked(access_token)}`,
				}
			}).GET("/v1/people:searchContacts", {
				params: {
					query: {
						query: normalized_query,
						readMask: read_mask,
					}
				}
			}).then(v => v.data?.results ?? [])
			: skipToken
	});
}
