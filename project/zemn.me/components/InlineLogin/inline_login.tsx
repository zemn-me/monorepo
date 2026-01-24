import classNames from "classnames";

import style from "#root/project/zemn.me/components/InlineLogin/inline_login.module.css";
import { useZemnMeAuth } from "#root/project/zemn.me/hook/useZemnMeAuth.js";
import { future_and_then, future_error, future_flatten_then, future_resolve } from "#root/ts/future/future.js";
import { OidcIdTokenClaimsSchema } from "#root/ts/oidc/id_token.js";
import { background } from "#root/ts/promise/ignore_result.js";



export function InlineLogin() {
	const [fut_idToken, , fut_promptForLogin] = useZemnMeAuth();

	const idTokenData = future_flatten_then(future_and_then(
		fut_idToken,
		tok => {
			// "unsafely" (not really because on client)
			// parse id_token
			const claims = tok.split(".")[1]!;
			const decoded = atob(claims);
			const r = OidcIdTokenClaimsSchema.safeParse(
				JSON.parse(decoded)
			);

			return r.success
				? future_resolve(r.data)
				: future_error(r.error)
		}
	))

	const loginButton = (error: boolean) => <button
		className={
			classNames(
				style.inlineLogin,
				error ? style.error : undefined,
			)
		}
		disabled={fut_promptForLogin(
			() => false, () => true, () => true
		)}
		onClick={fut_promptForLogin(
			p => background(p),
			() => undefined,
			() => undefined,
		)}
	>
		Log in
	</button>;

	return idTokenData(
		f => (f.name ?? f.sub)
				?<>Logged in as <i>{f.name ?? f.sub}</i>.</>
				: <>Logged in.</>
		,
		() => loginButton(false),
		err => {
			// eslint-disable-next-line no-console
			console.error(err);
			return loginButton(true);
		},
	)
}
