import { OIDCAuthenticationRequest } from "#root/ts/oidc/authentication_request.js";
import { OpenIDConfiguration } from "#root/ts/oidc/configuration.js";
import * as result from "#root/ts/result/result.js";


export function validateAuthenticationRequest(
	req: OIDCAuthenticationRequest,
	config: OpenIDConfiguration
): result.Result<OIDCAuthenticationRequest, Error> {
	const requestedScopes = new Set(req.scope.split(' ').map(s => s.trim()).filter(Boolean));
	const supportedScopesArray = (
		Array.isArray(config.scopes_supported)
			? config.scopes_supported
			: []
	);
	const supportedScopes = new Set(supportedScopesArray);
	const missingScopes = new Set(
		[...requestedScopes].filter(scope => !supportedScopes.has(scope))
	);

	if (missingScopes.size > 0) {
		return result.Err(new Error(
			`missing scope support: ${[...missingScopes].join(", ")}.`
		));
	}

	const supportedResponseTypesArray = (
		Array.isArray(config.response_types_supported)
			? config.response_types_supported
			: []
	);
	const supportedResponseTypes = new Set(supportedResponseTypesArray);

	if (!supportedResponseTypes.has(req.response_type)) {
		return result.Err(new Error(
			`missing response type support: ${req.response_type}`
		));
	}

	return result.Ok(req)
}
