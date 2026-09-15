import { useQuery } from '@tanstack/react-query';

import { useFetchClient } from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useQueryFuture } from '#root/ts/future/future.js';
import { watchOutParseIdToken } from '#root/ts/oidc/oidc.js';

import { collectReport, uniqueEvents } from './report.js';

export function useReport(
	token: string,
	startDate: string,
	endDate: string,
	revision: number
) {
	const client = useFetchClient(token);
	return useQueryFuture(
		useQuery({
			queryKey: [
				'analytics-report',
				watchOutParseIdToken.safeParse(token).data?.jti,
				startDate,
				endDate,
				revision,
			],
			queryFn: ({ signal }) =>
				collectReport(cursor =>
					client
						.GET('/admin/analytics/events', {
							signal,
							params: {
								query: {
									cursor,
									limit: 100,
									startDate,
									endDate,
								},
							},
						})
						.then(({ data, response }) => {
							if (!data)
								throw new Error(
									response.status === 403
										? 'Your account needs analytics read access.'
										: 'Could not load analytics. Please retry.'
								);
							return data;
						})
				).then(
					([events, complete]) =>
						[uniqueEvents(events), complete] as const
				),
			retry: false,
			gcTime: 0,
			staleTime: Infinity,
		})
	);
}
