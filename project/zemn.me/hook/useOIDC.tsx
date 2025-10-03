import { useAuthRedirect } from "#root/project/zemn.me/hook/useAuthRedirect.js";
import { useOpenIDConfiguration } from "#root/project/zemn.me/hook/useOpenIDConfiguration.js";
import { Issuer } from "#root/project/zemn.me/OAuth/clients.js";
import { OIDCAuthenticationRequest } from "#root/ts/oidc/authentication_request.js";
import { OIDCResponse } from "#root/ts/oidc/callback_params.js";
import { ID_Token, watchOutParseIdToken } from "#root/ts/oidc/oidc.js";
import { and_then as option_and_then, None, Some } from "#root/ts/option/types.js";
import { and_then_flatten as result_and_then_flatten, Err, Ok } from "#root/ts/result/result.js";
import { resultFromZod } from "#root/ts/zod/util.js";

function isUnexpiredIDToken(token: ID_Token): token is ID_Token {
	return token.exp > Math.floor(Date.now() / 1000);
}

export function allIdTokens(token: ID_Token): token is ID_Token {
	return true;
}


const params = union([OIDCImplicitAuthResponse, OIDCAuthErrorResponse]);

export function useOIDC(issuer: URL, req: OIDCAuthenticationRequest) {
	const config = useOpenIDConfiguration(issuer);

	const authEndp = config.data?.data?.authorization_endpoint;
	const authEndpoint = authEndp ?
		Some(new URL(authEndp[0]!)) : None;


	const authReq = option_and_then(
		authEndpoint,
		v => {
			const u = new URL(v);
			u.search = (new URLSearchParams(Object.entries(req))).toString();
			return u;
		}
	)

	// we should probably not just do this every time because it
	// is going to open so many windows.
	const respQuery = useAuthRedirect(
		authReq
	);

	const respParams =
		respQuery.data === undefined ?
			None : Some(respQuery.data);

	const parsedParams = option_and_then(
		respParams,
		result => result_and_then_flatten(
			result,
			v => resultFromZod(OIDCResponse.safeParse(v))
		)
	)

	// todo:(thomas) state generation / checking

	// handle case where we get an error
	const successParams = option_and_then(
		parsedParams,
		result => result_and_then_flatten(
			result,
			v => {
				if ('error' in v) return Err(new Error('remote server error'));
				return Ok(v)
			}
		)
	)






}

/**
 * Open a new tab for the user to do OIDC. The {@link useOIDC} hook
 * will automatically update to a defined value when the user completes
 * authentication.
 *
 * @param issuer
 */
export function requestOIDC(issuer?: Issuer) {
	const wndOrNull = window.open(`/auth?${new URLSearchParams([
		...issuer != undefined ? [
			["hint", issuer]
		] : []
	])}`, '_blank');

	const wnd = wndOrNull === null ?
		Err(new Error("window open blocked")) : Ok(wndOrNull);



	option_and_then(wnd, w => w.focus());

	return unwrap(wnd);
}



export default function Client() {
	const zq = params.safeParse(useRouter().query);
	const query = zq.success ? Ok(zq.data) : Err(zq.error);

	const success_params = result_and_then_flatten(query,
		params =>
			'error' in params?
				Err(new Error(params.error))
				: Ok(params)
	)

	const id_token = result_and_then_flatten(success_params,
		v => v.id_token !== undefined ? Ok(v.id_token) : Err(
			new Error("missing id_token in response")
		)
	)


	return unwrap_or_else(
		option_and_then(id_token, tok => <TokenExchanger token={tok} />),
		err => `${err}`
	)
}

function TokenExchanger({ token }: { token: string }) {
	const api = useZemnMeApi();

	// exchange foreign for local id_token
	const ownIdTokenQuery = api.useQuery('post', '/oauth2/token', {
		body: {
			requested_token_type: "urn:ietf:params:oauth:token-type:id_token",
			grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
			subject_token: token,
			subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
		}
	});



}
