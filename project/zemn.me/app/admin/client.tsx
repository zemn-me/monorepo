"use client";
import { useEffect, useState } from "react";

import { requestOIDC, useOIDC } from "#root/project/zemn.me/app/hook/useOIDC.js";
import { and_then as option_and_then, None, Option, Some, unwrap_or_else as option_unwrap_or_else } from "#root/ts/option/types.js";
import { and_then as result_and_then, unwrap_or_else as result_unwrap_or_else } from "#root/ts/result_types.js";

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

	return result_unwrap_or_else(
		result_and_then(
			googleAuth,
			r => option_unwrap_or_else(
				option_and_then(
					r,
					r => <p>Your Auth {r.id_token}</p>
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
}
