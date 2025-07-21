import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { useMemo } from 'react';

import type { paths } from "#root/project/zemn.me/api/api_client.gen";

export function useFetchClient() {
	return useMemo(() => createFetchClient<paths>({
		baseUrl: process.env["NEXT_PUBLIC_ZEMN_ME_API_BASE"] ?? "https://api.zemn.me",
	})
	, []);
}

export function useZemnMeApi() {
	const fetchClient = useFetchClient();

	return useMemo(() => createClient(fetchClient), [fetchClient]);
}

