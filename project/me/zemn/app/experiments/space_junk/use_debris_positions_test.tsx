import { expect, it } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SpaceObject } from './chart.js';
import { snapshotPositions } from './orbit.js';
import { useDebrisPositions } from './use_debris_positions.js';

const tle = [
	'1 29257U 98067AJ  06214.42846098  .00093793  00000-0  49733-3 0  9999',
	'2 29257 051.6364 308.9779 0007048 137.1293 223.0259 15.79733247  4533',
].join('\n');
const spatula: SpaceObject = {
	id: 29257,
	name: 'Spatula',
	piece: '1998-067AJ',
	kind: 'C',
	eva: true,
	start: '2006-07-12',
	end: '2006-09-29',
};

function renderPositions(client: QueryClient, iso: string, object = spatula) {
	function Positions() {
		const { markers } = useDebrisPositions(
			[{ object }],
			Date.parse(iso),
			iso.slice(0, 10),
			'2006-09-29'
		);
		return markers
			.map(({ fixed: { x, y, z } }) => [x, y, z].join(','))
			.join(' ');
	}
	return renderToStaticMarkup(
		<QueryClientProvider client={client}>
			<Positions />
		</QueryClientProvider>
	);
}

it('propagates across midnight in either direction as the selected archive loads or has no records', () => {
	const client = new QueryClient();
	try {
		client.setQueryData(['space-junk-elements', '2006-08-02'], tle);
		for (const instant of [
			'2006-08-01T23:59Z',
			'2006-08-03T00:00Z',
			'2006-08-03T00:01Z',
		]) {
			const rows = snapshotPositions(tle, new Date(instant));
			expect(rows).toHaveLength(1);
			expect(renderPositions(client, instant)).toBe(
				rows[0]!.slice(1).join(',')
			);
			client.setQueryData(
				['space-junk-elements', instant.slice(0, 10)],
				''
			);
			expect(renderPositions(client, instant)).toBe(
				rows[0]!.slice(1).join(',')
			);
		}
		// A neighboring file is no evidence of flight or of a recent measurement.
		expect(
			renderPositions(client, '2006-08-03T00:00Z', {
				...spatula,
				end: '2006-08-03',
			})
		).toBe('');
		client.setQueryData(['space-junk-elements', '2006-08-12'], tle);
		expect(renderPositions(client, '2006-08-13T00:00Z')).toBe('');
	} finally {
		client.clear();
	}
});
