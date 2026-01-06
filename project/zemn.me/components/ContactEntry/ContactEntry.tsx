import { useGoogleAuth } from "#root/project/zemn.me/hook/useGoogleAuth.js";
import { either } from "#root/ts/either/either.js";
import * as option from "#root/ts/option/types.js";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import createFetchClient from "openapi-fetch";
import type { paths } from "#root/third_party/com/googleapis/people/api_client.gen.js";


export function ContactEntry() {
	const [input, setInput] = useState();
	const id = useId();
	const [, access_token ] = useGoogleAuth([]);
	const contacts = useQuery({
		queryKey: ['contacts-search', input],
		queryFn: option.is_some(access_token)
			? async () => createFetchClient<paths>({
				baseUrl: "https://people.googleapis.com",
				headers: {
					Authorization: option.unwrap_unchecked(access_token),
				}
			}).GET("/v1/people:searchContacts", {
				params: {
					'query': input,
				}
			})
			: skipToken
	})


	return either(
		access_token,
		() => "You need to log in to use this.",
		tok =>
	)

	return <>
		<input list={id}/>
		<datalist id={id}>

		</datalist>
	</>
}
