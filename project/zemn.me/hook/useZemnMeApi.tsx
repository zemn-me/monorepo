import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { createContext, ReactNode, useContext, useMemo } from 'react';

import type { paths } from "#root/project/zemn.me/api/api_client.gen";

const DEFAULT_BASE_URL = "https://api.zemn.me";

const ApiBaseContext = createContext<string>(
        process.env.NEXT_PUBLIC_ZEMN_ME_API_BASE ?? DEFAULT_BASE_URL,
);

export interface ApiBaseProviderProps {
        readonly baseUrl?: string;
        readonly children?: ReactNode;
}

export function ApiBaseProvider({ baseUrl, children }: ApiBaseProviderProps) {
        return <ApiBaseContext.Provider value={baseUrl ?? process.env.NEXT_PUBLIC_ZEMN_ME_API_BASE ?? DEFAULT_BASE_URL}>
                {children}
        </ApiBaseContext.Provider>;
}

export function useApiBase() {
        return useContext(ApiBaseContext);
}

export function useFetchClient() {
        const baseUrl = useApiBase();
        return useMemo(() => createFetchClient<paths>({
                baseUrl,
        })
        , [baseUrl]);
}

export function useZemnMeApi() {
	const fetchClient = useFetchClient();

	return useMemo(() => createClient(fetchClient), [fetchClient]);
}

