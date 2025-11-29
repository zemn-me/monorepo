import { OIDCAuthenticationResponse } from "#root/ts/oidc/authentication_response.js";
import * as result from "#root/ts/result/result.js";


export function parseOIDCAuthenticationResult(
	params: unknown
) {
	const p = OIDCAuthenticationResponse.safeParse(params);
	return p.success
			? result.Ok(p.data)
			: result.Err(p.error)


}
