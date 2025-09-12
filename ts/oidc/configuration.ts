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

export const getOpenidConfig = (issuer: URL) => {
	const clone = new URL(issuer);
	clone.pathname = openidConfigPathName;

	return fetch(clone).then(b => b.json())
		.then(json => {
			const r = openidConfiguration.safeParse(json);
			if (!r.success) return Err(r.error);
			return Ok(r.data)
		})
}
