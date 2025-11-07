import { OIDCAuthenticationRequest } from "#root/ts/oidc/authentication_request.js";
import { OpenIDConfiguration } from "#root/ts/oidc/configuration.js";
import * as option from "#root/ts/option/types.js";


export function validateAuthenticationRequest(
	req: OIDCAuthenticationRequest,
	config: OpenIDConfiguration
): option.Option<Error> {
	const reqScopes = new Set(req.scope.split(' '));
	const confScopes = new Set(config.scopes_supported);
	const missingScopes = reqScopes.difference(confScopes);

	if (missingScopes.size > 0) {
		return option.Some(new Error(
			`missing scope support: ${[missingScopes].join(", ")}.`
		))
	}

	const confResponseTypes = new Set(config.response_types_supported);

	if (!confResponseTypes.has(req.response_type)) {
		return option.Some(new Error(
			`missing response type support: ${req.response_type}`
		))
	};

	return option.None
}
