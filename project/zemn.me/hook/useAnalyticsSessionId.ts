import { useQuery } from '@tanstack/react-query';

export const ANALYTICS_SESSION_ID_QUERY_KEY = ['analytics_session_id'] as const;

export function useAnalyticsSessionId() {
	return useQuery({
		queryKey: ANALYTICS_SESSION_ID_QUERY_KEY,
		queryFn: () => crypto.randomUUID(),
		staleTime: Infinity,
		gcTime: Infinity,
	});
}
