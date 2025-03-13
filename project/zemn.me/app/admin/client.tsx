"use client";
import { useQuery } from "@tanstack/react-query";
import createClient from "openapi-fetch";
import { useEffect, useState } from "react";

import { requestOIDC, useOIDC } from "#root/project/zemn.me/app/hook/useOIDC.js";
import Link from "#root/project/zemn.me/components/Link/index.js";
import { ID_Token } from "#root/ts/oidc/oidc.js";
import { and_then as option_and_then, flatten, is_none, None, Option, option_result_transpose, Some, unwrap_or as option_unwrap_or, unwrap_or_else as option_unwrap_or_else, unwrap_unchecked as option_unwrap_unchecked } from "#root/ts/option/types.js";
import type { paths } from "#root/ts/pulumi/zemn.me/api/api_client.gen";
import { and_then as result_and_then, is_err, unwrap_err_unchecked, unwrap_or as result_unwrap_or, unwrap_or_else as result_unwrap_or_else, unwrap_unchecked as result_unwrap_unchecked } from "#root/ts/result_types.js";

const apiClient = createClient<paths>({
	baseUrl: "https://api.zemn.me"
})


export default function Admin() {
	const googleAuth = useOIDC((v): v is ID_Token => v.iss == "https://accounts.google.com");
	const authToken = option_and_then(
		googleAuth,
		q => result_and_then(
			q,
			v => v[0] === undefined ? None : Some(v[0])
		)
	);

	const at = result_and_then(option_result_transpose(authToken),
		o => flatten(o)
	);

	const [openWindowHnd, setOpenWindowHnd] = useState<Option<WindowProxy>>(None);

	// when googleAuth is something, make sure to close any open window handles
	useEffect(
		() => void result_and_then(
			at,
			r => option_and_then(
				r,
				() => option_and_then(
					openWindowHnd,
					wnd => wnd.close()
				)
			)
		)
	, [at])

	const authTokenCacheKey = result_unwrap_or(result_and_then(
		at,
		o => option_unwrap_or(option_and_then(
			o,
			o => o
		), undefined)
	), undefined);

	const phoneNumber = useQuery({
		queryKey: ['callbox', 'phone number', authTokenCacheKey],
		queryFn: async () => {
			if (is_err(at)) return <>
				⚠ {unwrap_err_unchecked(at)}
			</>;

			const auth = result_unwrap_unchecked(at);

			if (is_none(auth)) return <>
				You need to log in to see this.
			</>;

			const {phoneNumber} = await apiClient.GET("/phone/number", {
				headers: {
					Authorization: option_unwrap_unchecked(auth)
				}
			}).then(v => v.data!);

			const pnn = phoneNumber;

			return <>
				Callbox phone number is currently: {" "}
				<Link href={`tel:${pnn}`}>{pnn}</Link>
			</>
		}
	});

	const login_button = result_unwrap_or_else(
		result_and_then(
			at,
			r => option_unwrap_or_else(
				option_and_then(
					r,
					() => <p>You are logged in.</p>
				),
				() => <button onClick={() => setOpenWindowHnd(Some(requestOIDC("https://accounts.google.com")!))}>
					<p>
						You are not authenticated to perform this operation.
					</p>
					<p>
						Please click here to authenticate.
					</p>
				</button>)
		), e => <>error: {e}</>);

	return <>
		{phoneNumber.error !== null ? <p>
			{phoneNumber.error.toString()}
		</p>: null}
		{phoneNumber.data !== undefined ? <p>
			{phoneNumber.data}
		</p>: null}
		<p>{login_button}</p>
	</>
}
