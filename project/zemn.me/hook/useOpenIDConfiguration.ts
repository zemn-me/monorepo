import { useQuery } from "@tanstack/react-query";
import type { output } from "zod";

import { openidConfigPathName, openidConfiguration } from "#root/ts/oidc/configuration.js";
import type { Option } from "#root/ts/option/types.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";
import type { Result } from "#root/ts/result/result.js";


type OpenIDConfiguration = output<typeof openidConfiguration>;

export function useOpenIDConfiguration(issuer: URL): Option<Result<OpenIDConfiguration, Error>> {
	const target = new URL(issuer);
	target.pathname += openidConfigPathName;

	const query = useQuery<OpenIDConfiguration, Error>({
		queryKey: ["get", target.toString()],
		queryFn: async () => {
			const response = await fetch(target);
			const json = await response.json();
			return openidConfiguration.parse(json);
		},
	});

	return queryResult(query);
}
