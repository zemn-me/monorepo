import { skipToken, useQuery } from "@tanstack/react-query";
import createFetchClient from "openapi-fetch";

import { useGoogleAuth } from "#root/project/zemn.me/hook/useGoogleAuth.js";
import type { paths } from "#root/third_party/com/googleapis/people/api_client.gen.js";
import * as option from "#root/ts/option/types.js";



export function useGetExactContact(
	matchOn: "emailAddresses" | "phoneNumbers",
	content: string | undefined
) {
	const [, access_token ] = useGoogleAuth([]);
	return useQuery({
		queryKey: ['contacts-search', content],
		queryFn: option.is_some(access_token) && content !== undefined
			? async () => createFetchClient<paths>({
				baseUrl: "https://people.googleapis.com",
				headers: {
					Authorization: option.unwrap_unchecked(access_token),
				}
			}).GET("/v1/people:searchContacts", {
				params: {
					query: {
						query: content
					}
				}
			}).then(
				v => v.data?.results?.filter(
					item => item.person?.[matchOn]?.some(
						ident => ident.value === content
					)
				)
			)
			: skipToken
	})
}
