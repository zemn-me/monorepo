import { array, object, output, string, url } from 'zod/mini';

export const openidConfiguration = object({
	issuer: string(),
	response_types_supported: array(string()),
	subject_types_supported: array(string()),
	scopes_supported: array(string()),
	claims_supported: array(string()),
	authorization_endpoint: url(),
	jwks_uri: url(),
});

export const openidConfigPathName = ".well-known/openid-configuration";


export type OpenIDConfiguration = output<typeof openidConfiguration>;
