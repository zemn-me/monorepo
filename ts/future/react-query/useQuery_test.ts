import { describe, expect, it } from '@jest/globals';
import { UseQueryResult } from '@tanstack/react-query';

import { useQueryFuture } from '#root/ts/future/react-query/useQuery.js';

describe('useQueryFuture', () => {
	it.each([
		[
			{ status: 'success', data: ['first todo'] },
			['first todo'],
		],
		[{ status: 'pending' }, 'loading'],
		[{ status: 'error', error: new Error('offline') }, 'offline'],
	] as const)('converts React Query state %#', (query, expected) => {
		const future = useQueryFuture(
			query as unknown as UseQueryResult<string[], Error>
		);

		expect(
			future(
				value => value,
				() => 'loading',
				error => error.message
			)
		).toEqual(expected);
	});
});
