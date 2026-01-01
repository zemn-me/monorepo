import { useQuery } from "@tanstack/react-query";

import { useOIDCConfig } from "#root/project/zemn.me/hook/useOIDCConfig.js";
import { useWindowCallback } from "#root/project/zemn.me/hook/useWindowCallback.js";
import { OIDCAuthenticationRequest } from "#root/ts/oidc/authentication_request.js";
import { validateAuthenticationRequest } from "#root/ts/oidc/validate_authentication_request.js";
import { Option } from "#root/ts/option/types.js";
import * as option from "#root/ts/option/types.js";
import * as result from "#root/ts/result/result.js";


async function fetchEntropy(): Promise<string> {
  const bytes = new Uint8Array(128); // 1024 bits
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export type useOIDCReturnType = [
	id_token: Option<string>,
	access_token: Option<string>,
	promptForLogin: Option<() => Promise<void>>,
];

export function useOIDC(
	issuer: string,
	clientID: string,
	scopes: string[],
): useOIDCReturnType {
	const oidcConfig = useOIDCConfig(issuer);
	const entropy = useQuery({
		queryKey: ['useoidc entropy', issuer],
		queryFn: fetchEntropy,
		staleTime: Infinity
	});

	const authRq = entropy.isSuccess
		? option.Some<OIDCAuthenticationRequest>({
			response_type: 'token id_token',
			client_id: clientID,
			redirect_uri: `${window.location.origin}/callback`,
			scope: ['openid', ...scopes].join(" "),
			state: entropy.data,
			nonce: entropy.data,
		})
		: option.None

	const op_oidc_config = oidcConfig.status === 'success'
		? option.Some(oidcConfig.data)
		: option.None;

	const validated_auth_req =
		option.zipped(
			authRq,
			op_oidc_config,
			(authRq, config) => validateAuthenticationRequest(
				authRq, config
			)
		);

	const targetURL = option.and_option_result_zipped(
		op_oidc_config,
		validated_auth_req,
		(conf, params) => {
			const u = new URL(conf.authorization_endpoint);
			u.search = (new URLSearchParams(params)).toString();
			return u;
		}
	);

	const [callback, requestCallback] = useWindowCallback();


	const requestConsent = option.and_then(
		targetURL, u => () => requestCallback(u)
	);






}
