import { OIDCAuthenticationRequest } from "#root/ts/oidc/authentication_request.js";
import { OpenIDConfiguration } from "#root/ts/oidc/configuration.js";
import { Option, Some } from "#root/ts/option/types.js";


export function validateAuthenticationRequest(
	req: OIDCAuthenticationRequest,
	config: OpenIDConfiguration
): Option<Error> {
	const reqScopes = new Set(req.scope.split(' '));
	const confScopes = new Set(config.scopes_supported);
	const missingScopes = reqScopes.difference(confScopes);

	if (missingScopes.size > 0) {
		return Some(new Error(
			`missing scope support: ${[missingScopes].join(", ")}.`
		))
	}

	const confResponseTypes = new Set(config.response_types_supported);

	if (!confResponseTypes.has(req.response_type)) {
		return Some(new Error(
			`missing response type support: ${req.response_type}`
		))
	};

	return None
}
