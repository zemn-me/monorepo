import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { useMemo } from 'react';

import type { paths } from "#root/project/zemn.me/api/api_client.gen";
import { ZEMN_ME_API_BASE } from "#root/project/zemn.me/constants/constants.js";

export function useFetchClient() {
	return useMemo(() => createFetchClient<paths>({
		baseUrl: ZEMN_ME_API_BASE,
	})
	, []);
}

export function useZemnMeApi() {
	const fetchClient = useFetchClient();

	return useMemo(() => createClient(fetchClient), [fetchClient]);
}

