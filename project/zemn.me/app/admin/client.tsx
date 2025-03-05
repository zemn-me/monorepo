"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { requestOIDC, useOIDC } from "#root/project/zemn.me/app/hook/useOIDC.js";
import { and_then as option_and_then, is_none, None, Option, Some, unwrap_or_else as option_unwrap_or_else, unwrap_unchecked as option_unwrap_unchecked } from "#root/ts/option/types.js";
import { and_then as result_and_then, is_err, unwrap_err_unchecked, unwrap_or_else as result_unwrap_or_else, unwrap_unchecked as result_unwrap_unchecked } from "#root/ts/result_types.js";

export default function Admin() {
	const googleAuth = useOIDC("https://accounts.google.com");
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

	const phoneNumber = useQuery({
		queryKey: ['callbox', 'phone number', googleAuth],
		queryFn: async () => {
			if (is_err(googleAuth)) return <>
				⚠ {unwrap_err_unchecked(googleAuth)}
			</>;

			const auth = result_unwrap_unchecked(googleAuth);

			if (is_none(auth)) return <>
				You need to log in to see this.
			</>;

			return <>
				Callbox phone number is currently:
				{await fetch("https://api.zemn.me/phone/number", {
					headers: {
						Authorization: option_unwrap_unchecked(auth).id_token,
					}
				})
					.then(v => v.json())}
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
