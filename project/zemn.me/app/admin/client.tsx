"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";

import { requestOIDC, useOIDC } from "#root/project/zemn.me/app/hook/useOIDC.js";
import { ID_Token } from "#root/ts/oidc/oidc.js";
import { and_then as option_and_then, is_none, None, Option, Some, unwrap_or as option_unwrap_or, unwrap_or_else as option_unwrap_or_else, unwrap_unchecked as option_unwrap_unchecked } from "#root/ts/option/types.js";
import { and_then as result_and_then, is_err, unwrap_err_unchecked, unwrap_or as result_unwrap_or, unwrap_or_else as result_unwrap_or_else, unwrap_unchecked as result_unwrap_unchecked, unwrap_unchecked as unwrap_result_unchecked } from "#root/ts/result_types.js";
import { resultFromZod } from "#root/ts/zod/util.js";

const phoneNumberResponseSchema = z.strictObject({
	phoneNumber: z.string()
})

export default function Admin() {
	const googleAuth = useOIDC((v): v is ID_Token => v.iss == "https://accounts.google.com");
	const [openWindowHnd, setOpenWindowHnd] = useState<Option<WindowProxy>>(None);

	// when googleAuth is something, make sure to close any open window handles
	useEffect(
		() => void result_and_then(
			googleAuth,
			r => option_and_then(
				r,
				() => option_and_then(
					openWindowHnd,
					wnd => wnd.close()
				)
			)
		)
	, [googleAuth])

	const authTokenCacheKey = result_unwrap_or(result_and_then(
		googleAuth,
		o => option_unwrap_or(option_and_then(
			o,
			o => o.id_token
		), undefined)
	), undefined);

	const phoneNumber = useQuery({
		queryKey: ['callbox', 'phone number', authTokenCacheKey],
		queryFn: async () => {
			if (is_err(googleAuth)) return <>
				⚠ {unwrap_err_unchecked(googleAuth)}
			</>;

			const auth = result_unwrap_unchecked(googleAuth);

			if (is_none(auth)) return <>
				You need to log in to see this.
			</>;

			const pnRespJson = await fetch("https://api.zemn.me/phone/number", {
				headers: {
					Authorization: option_unwrap_unchecked(auth).id_token,
				}
			}) .then(v => v.json());

			const pn = resultFromZod(phoneNumberResponseSchema.safeParse(pnRespJson));

			if (is_err(pn)) return <>
					⚠ {unwrap_err_unchecked(pn).toString()}
			</>;

			return <>
				Callbox phone number is currently: {" "}
				{unwrap_result_unchecked(pn).phoneNumber}
			</>
		}
	});

	const login_button = result_unwrap_or_else(
		result_and_then(
			googleAuth,
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
