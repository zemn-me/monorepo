"use client"

import { useRouter } from "next/router";
import { queryObjects } from "v8";
import { union } from "zod/mini"

import { useZemnMeApi } from "#root/project/zemn.me/hook/useZemnMeApi.js";
import { OIDCAuthErrorResponse, OIDCImplicitAuthResponse } from "#root/ts/oidc/callback_params.js"
import { and_then, and_then_flatten, Err, Ok, unwrap_or, unwrap_or_else } from "#root/ts/result/result.js";
import { resultFromZod } from "#root/ts/zod/util.js";

/**
 * @fileoverview
 * OAuth callback page
 */

const params = union([OIDCImplicitAuthResponse, OIDCAuthErrorResponse]);

export default function Client() {
	const zq = params.safeParse(useRouter().query);
	const query = zq.success ? Ok(zq.data) : Err(zq.error);

	const success_params = and_then_flatten(query,
		params =>
			'error' in params?
				Err(new Error(params.error))
				: Ok(params)
	)

	const id_token = and_then_flatten(success_params,
		v => v.id_token !== undefined ? Ok(v.id_token) : Err(
			new Error("missing id_token in response")
		)
	)


	return unwrap_or_else(
		and_then(id_token, tok => <TokenExchanger token={tok} />),
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
