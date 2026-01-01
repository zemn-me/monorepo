import { useQuery } from '@tanstack/react-query';

import { openidConfiguration } from '#root/ts/oidc/configuration.js';
import { oidcConfigURLForIssuer } from '#root/ts/oidc/oidc.js';


export function useOIDCConfig(issuer: string) {
	return useQuery({
		queryFn: () => fetch(oidcConfigURLForIssuer(issuer))
			.then(config => config.json())
			.then(config =>
				openidConfiguration
					.parse(config)
			),
		queryKey: ['oidc-config', issuer],
	});
}
