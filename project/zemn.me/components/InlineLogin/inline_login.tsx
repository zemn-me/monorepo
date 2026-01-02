import classNames from "classnames";

import style from "#root/project/zemn.me/components/InlineLogin/inline_login.module.css";
import { useZemnMeAuth } from "#root/project/zemn.me/hook/useZemnMeAuth.js";
import { either } from "#root/ts/either/either.js";
import { OidcIdTokenClaimsSchema } from "#root/ts/oidc/id_token.js";
import * as option from "#root/ts/option/types.js";
import { background } from "#root/ts/promise/ignore_result.js";
import * as result from "#root/ts/result/result.js";



export function InlineLogin() {
	const [idToken, , promptForLogin] = useZemnMeAuth();

	const idTokenData = option.and_then(
		idToken,
		tok => {
			// "unsafely" (not really because on client)
			// parse id_token
			const claims = tok.split(".")[1]!;
			const decoded = atob(claims);
			const r = OidcIdTokenClaimsSchema.safeParse(
				JSON.parse(decoded)
			);

			return r.success
				? result.Ok(r.data)
				: result.Err(r.error)
		}
	)

	const loginButton = (error: boolean) => <button
		className={
			classNames(
				style.inlineLogin,
				error? style.error: undefined,
			)
		}
		disabled={option.is_none(promptForLogin)}
		onClick={option.unwrap_or(
			option.and_then(promptForLogin, background),
		undefined)}
	>
		{option.is_some(promptForLogin)? "Log in" : "Log in…"}
	</button>;

	return either(
		idTokenData,
		// not loaded or logged out
		() => loginButton(false),
		loadedToken => either(
			loadedToken,
			_ => loginButton(true),
			f => (f.name ?? f.sub)
				?<>Logged in as <i>{f.name ?? f.sub}</i>.</>
				: <>Logged in.</>
		),
	)
}
