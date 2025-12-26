import { useOIDC } from "#root/project/zemn.me/hook/useOIDC.js";
import { either } from "#root/ts/either/either.js";
import { OidcIdTokenClaimsSchema } from "#root/ts/oidc/id_token.js";
import * as option from "#root/ts/option/types.js";
import * as result from "#root/ts/result/result.js";



export function InlineLogin() {
	const [idToken, promptForLogin] = useOIDC();

	const idTokenData = option.and_then(
		idToken,
		tok => {
			const r = OidcIdTokenClaimsSchema.safeParse(tok);

			return r.success
				? result.Ok(r.data)
				: result.Err(r.error)
		}
	)

	const loginButton = <button
		onClick={option.unwrap_or(promptForLogin, undefined)}
		disabled={option.is_none(promptForLogin)}
	>
		{option.is_some(promptForLogin)? "Log in" : "Log in…"}
	</button>;

	return either(
		idTokenData,
		// not loaded or logged out
		() => loginButton,
		loadedToken => either(
			loadedToken,
			e => {
				console.error(e);
				return loginButton;
			},
			f => f.name
				?<>Logged in as <i>{f.name}</i>.</>
				: <>Logged in.</>
		),
	)
}
