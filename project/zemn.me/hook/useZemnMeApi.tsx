import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { useMemo } from 'react';

import type { paths } from "#root/project/zemn.me/api/api_client.gen";

export function useFetchClient() {
        return useMemo(() => {
                const env = process.env.NODE_ENV;
                let baseUrl = "https://api.zemn.me";
                if (env === "development") {
                        baseUrl = "http://localhost:9898";
                } else if (env === "production") {
                        baseUrl = "https://api.zemn.me";
                }
                return createFetchClient<paths>({
                        baseUrl,
                });
        }
        , []);
}

export function useZemnMeApi() {
	const fetchClient = useFetchClient();

	return useMemo(() => createClient(fetchClient), [fetchClient]);
}

