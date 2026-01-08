import { skipToken, useQuery } from "@tanstack/react-query";
import parsePhoneNumber from 'libphonenumber-js'
import createFetchClient from "openapi-fetch";

import { useGoogleAuth } from "#root/project/zemn.me/hook/useGoogleAuth.js";
import type { paths } from "#root/third_party/com/googleapis/people/api_client.gen.js";
import * as option from "#root/ts/option/types.js";


function phoneNumberEqual(
	a: string,
	b: string
): boolean {
	const [c, d] = [a, b].map(v => v.replaceAll(/-/g, " "))
	return c === d;
}


export function useGetExactContact(
	matchOn: "emailAddresses" | "phoneNumbers",
	content: string | undefined
) {
	// Search uses a lazy cache that is updated after a request. Clients should
	// first send a warmup search request with an empty query to make sure the
	// cache has the latest data.
	const c =

		content
			? parsePhoneNumber(content)?.formatInternational() ?? ""
			: ""

	// normalise the phone number via libphonenumber because the google people
	// api somehow does not index the canonical number only the formatted
	// number

	const [, access_token ] = useGoogleAuth([]);
	return useQuery({
		queryKey: ['contacts-search', c],
		queryFn: option.is_some(access_token)
			? async () => createFetchClient<paths>({
				baseUrl: "https://people.googleapis.com",
				headers: {
					Authorization: `Bearer ${option.unwrap_unchecked(access_token)}`,
				}
			}).GET("/v1/people:searchContacts", {
				params: {
					query: {
						query: c,
						readMask: "emailAddresses,phoneNumbers,nicknames,names"
					}
				}
			}).then(
				v => v.data?.results?.filter(
					item => item.person?.[matchOn]?.some(
						ident => matchOn === "phoneNumbers"
							? phoneNumberEqual(ident.value??"", c)
							: ident.value === c
					)
				)
			)
			: skipToken
	})
}
