'use client';


import { fixedTimeStringEquals } from '#root/ts/crypto/fixed_time_string_comparison.js';
import { HumanError } from '#root/ts/errors.js';
import {
	OIDCAuthenticationRequest,
} from '#root/ts/oidc/authentication_request.js';
import { EOAuthError } from '#root/ts/oidc/error.js';
import { parseOIDCAuthenticationResult } from '#root/ts/oidc/result.js';
import { useAbsolutePath } from '#root/ts/oidc/useAbsolutePath.js';
import { useOIDCConfig } from '#root/ts/oidc/useOIDCConfig.js';
import { useWindowCallback } from '#root/ts/oidc/useWindowCallback.js';
import { validateAuthenticationRequest } from '#root/ts/oidc/validate_authentication_request.js';
import { Option } from '#root/ts/option/types.js';
import * as option from '#root/ts/option/types.js';
import * as future from '#root/ts/result/react-query/future.js'
import { queryResult } from '#root/ts/result/react-query/queryResult.js';
import { useFuture } from '#root/ts/result/react-query/useQuery.js';
import * as result from '#root/ts/result/result.js';

export interface UseOIDCOptions extends Omit<
	OIDCAuthenticationRequest,
	'redirect_uri'
> {
	readonly issuer: string
	readonly response_type: 'code token id_token',
}

async function fetchEntropy(): Promise<string> {
	const bytes = new Uint8Array(128); // 1024 bits
	crypto.getRandomValues(bytes);
	return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function useEntropy<E>(partitionKey: future.Future<string, E>) {
	const q = future.and_then(
		partitionKey,
		key => ({
			fn: fetchEntropy,
			key: ['entropy, partition:', key],
			staleTime: Infinity
		})
	)
	return useFuture(q)
}

function useFixedTimeStringEquals<E>(strings: future.Future<[string, string], E>) {
	return useFuture(
		future.and_then(
			strings,
			([a, b]) => ({
				fn: () => fixedTimeStringEquals(a, b),
				key: ['=', a, b],
				// or the key comparison will be an oracle
				staleTime: 0,
			})
		)
	)
}

export function useOIDC(options: Option<UseOIDCOptions>) {
	const issuer = option.field(options, 'issuer');
	const redirectUri = useAbsolutePath('/callback');

	const oidc_config = queryResult(useOIDCConfig(issuer));

	future.debug('oidc config', oidc_config);

	const entropy = useEntropy(future.from_option(issuer));
	const unvalidated_authRq = future.zipped_3(
		future.from_option(redirectUri),
		future.from_option(options),
		entropy,
		(redirect_uri, options, entropy): OIDCAuthenticationRequest => ({
			...options,
			state: entropy,
			nonce: entropy, // okay, not true but idgaf
			redirect_uri
		})
	)

	future.debug('unvalid -authrq', unvalidated_authRq)

	// makes it an error to have an invalid request for the
	// config
	const authRq = future.flatten(future.zipped(
		unvalidated_authRq,
		oidc_config,
		(r, c) => option.if_else(
			validateAuthenticationRequest(r, c),
			e => future.error(
				new HumanError(
					`had trouble making a good identity request to ${c.issuer}`,
					{ cause: e }
				)
			),
			() => future.success(r)
		)
	));

	const targetURL = future.zipped(
		oidc_config,
		authRq,
		(conf, req) => {
			const u = new URL(conf.authorization_endpoint);
			u.search = new URLSearchParams(req).toString();
			return u;
		}
	)

	future.debug('targeturl', targetURL);

	const [callback, requestCallback] = useWindowCallback();

	const requestConsent = future.and_then(
		targetURL, u => () => requestCallback(u)
	);

	const callbackV = future.zipped(
		callback, // if we can't request consent, notify downstream!
		targetURL,
		c => c
	);


	const unvalidatedAuthResponse = future.and_then_flatten(
		callbackV,
		v => {
			const href = new URL(v);

			const mixedParams =
				Object.fromEntries([
					...href.searchParams,
					...new URLSearchParams(
						href.hash.slice(1)
					)
				])



			return future.from_result(result.or_else(
				parseOIDCAuthenticationResult(mixedParams),
				e => result.Err(new HumanError(
					'the identity server responded weirdly',
					{ cause: e }
				))
			))
		}
	);

	future.debug('authresp', unvalidatedAuthResponse);

	const stateValid = useFixedTimeStringEquals(
		future.zipped(
			unvalidatedAuthResponse,
			entropy,
			(a, b) => [a.state ?? "", b]
		)
	);

	const authResponse = future.flatten(future.and_then_flatten(
		stateValid,
		ok =>
			ok ?
				future.success(unvalidatedAuthResponse) :
				future.error(new HumanError(
					'incorrect temporary password. please try from the beginning!',
					{ cause: new Error('invalid state challenge') }
				))
	));

	const authSuccessResponse = future.and_then_flatten(
		authResponse,
		rsp => 'error' in rsp
			? future.error(new HumanError(
				'the identity server thinks we messed up',
				{ cause: new EOAuthError(rsp) }
			))
			: future.success(rsp)
	)

	const id_token = future.and_then_flatten(
		authSuccessResponse,
		v => v.id_token ? future.success(v.id_token) : future.error(
			new HumanError(
				'the identity server responded in a weird way...',
				{ cause: new Error('missing id_token') })
		));

	const access_token = future.and_then_flatten(
		authSuccessResponse,
		v => v.access_token ? future.success(v.access_token) : future.error(
			new HumanError(
				'the identity server responded in a weird way!',
				{ cause: new Error('missing access_token')}
			)
		));

	future.debug('acess_token', access_token);

	return [access_token, id_token, requestConsent] as const;
}
