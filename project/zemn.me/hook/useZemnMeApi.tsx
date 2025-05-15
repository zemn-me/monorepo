import { useMutation, useQuery } from '@tanstack/react-query';
import { createClient } from 'openapi-fetch';
import { useMemo } from 'react';

import type { components, paths } from "#root/project/zemn.me/api/api_client.gen";

// todo: use openapi-react-query

export function useZemnMeApi(
	Authorization?: string,
) {
	const apiClient = useMemo(() => createClient<paths>({
		baseUrl: "https://api.zemn.me",
		headers: {
			Authorization
		},
	}), [Authorization]);

	const getSettings = useQuery({
		queryKey: ["settings"],
		queryFn: async () => {
			const response = await apiClient.callbox.getSettings();
			return response.data;
		},
	});

	const updateSettings = useMutation({
		mutationFn: async (settings: components["schemas"]["CallboxSettings"]) => {
			const response = await apiClient.callbox.updateSettings({ body: settings });
			return response.data;
		},
	});

	return { getSettings, updateSettings };
}
