import { useQuery } from "@tanstack/react-query";

import { openidConfigPathName, openidConfiguration } from "#root/ts/oidc/configuration.js";


export function useOpenIDConfiguration(issuer: URL) {
	const target = new URL(issuer);

	target.pathname += openidConfigPathName;

	return useQuery({
		queryKey: ['get', target.toString()],
		queryFn: () => fetch(target).then(
			v => v.json()
		).then(json => openidConfiguration.safeParse(json))
	})
}
