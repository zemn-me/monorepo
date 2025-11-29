import { skipToken, useQuery } from '@tanstack/react-query';

import { openidConfiguration } from '#root/ts/oidc/configuration.js';
import { oidcConfigURLForIssuer } from '#root/ts/oidc/oidc.js';
import * as option from '#root/ts/option/types.js';

/** Fetch and parse OIDC discovery doc for a given issuer (if provided). */
export function useOIDCConfig(issuer: option.Option<string>) {
	return useQuery({
		queryKey: ['oidc-config', option.unwrap_or(issuer, 'none')],
		queryFn: option.is_some(issuer)
			? () =>
				fetch(oidcConfigURLForIssuer(option.unwrap_unchecked(issuer)))
					.then(config => config.json())
					.then(config => openidConfiguration.parse(config))
			: skipToken,
	});
}
