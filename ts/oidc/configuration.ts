import { array, object, string, url } from 'zod/mini';

import { Err, Ok } from '#root/ts/result/result.js';

export const openidConfiguration = object({
	issuer: string(),
	response_types_supported: array(string()),
	subject_types_supported: array(string()),
	scopes_supported: array(string()),
	claims_supported: array(string()),
	authorization_endpoint: array(url()),
	jwks_uri: array(url()),
});

export const openidConfigPathName = ".well-known/openid-configuration";
