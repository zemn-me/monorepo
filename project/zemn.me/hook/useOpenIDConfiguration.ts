import { useQuery } from "@tanstack/react-query";

import { openidConfigPathName, openidConfiguration } from "#root/ts/oidc/configuration.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";


export function useOpenIDConfiguration(issuer: URL) {
	const target = new URL(issuer);

	target.pathname += openidConfigPathName;

	return queryResult(useQuery({
		queryKey: ['get', target.toString()],
		queryFn: () => fetch(target).then(
			v => v.json()
		).then(json => openidConfiguration.safeParse(json))
	}))
}
