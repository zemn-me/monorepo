import { useQueryClient } from "@tanstack/react-query";
import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { useMemo } from 'react';

import type { paths } from "#root/project/zemn.me/api/api_client.gen";
import { ZEMN_ME_API_BASE } from "#root/project/zemn.me/constants/constants.js";

export function useFetchClient(Authorization?: string) {
	return useMemo(() => createFetchClient<paths>({
		baseUrl: ZEMN_ME_API_BASE,
		headers: {
			Authorization
		}
	})
	, []);
}

export function useZemnMeApi(Authorization?: string) {
	const fetchClient = useFetchClient(Authorization);

	return useMemo(() => createClient(fetchClient), [fetchClient]);
}

export function useGetGrievances(Authorization: string) {
	return useZemnMeApi(Authorization).useQuery("get", "/grievances");
}

function useinvalidateGrievances() {
	const queryClient = useQueryClient();
	return () => void queryClient.invalidateQueries({ queryKey: ["get", "/grievances"] });
}

export function usePostGrievances(Authorization: string) {
	const invalidateGrievances = useinvalidateGrievances();
	return useZemnMeApi(Authorization).useMutation("post", "/grievances", {
		onSuccess: () => void invalidateGrievances(),
	});
}

export function useDeleteGrievances(Authorization: string) {
	const invalidateGrievances = useinvalidateGrievances();
	return useZemnMeApi(Authorization).useMutation("delete", "/grievance/{id}", {
		onSuccess: () => void invalidateGrievances(),
	});
}


