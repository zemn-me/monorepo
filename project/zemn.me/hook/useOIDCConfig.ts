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
			).then(
				config => {
					if (issuer != "https://accounts.google.com")
						return config;

					// for some reason Google doesn't properly advertise
					// its OAuth scopes.
					config.scopes_supported = [...new Set([
						...config.scopes_supported,
						"https://www.googleapis.com/auth/contacts.readonly",
					])]
				}
			),
		queryKey: ['oidc-config', issuer],
	});
}
