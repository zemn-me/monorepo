import { expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
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

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
	value: true,
	configurable: true,
});

function Positions({ iso, object }: { iso: string; object?: SpaceObject }) {
	const { markers, instant } = useDebrisPositions(
		object ? [{ object }] : [],
		Date.parse(iso),
		iso.slice(0, 10),
		'2006-09-29'
	);
	return (
		<time dateTime={new Date(instant).toISOString()}>
			{markers
				.map(({ fixed: { x, y, z } }) => [x, y, z].join(','))
				.join(' ')}
		</time>
	);
}

function chart() {
	const client = new QueryClient();
	const container = document.createElement('div');
	const root = createRoot(container);
	return {
		archive(day: string, text: string) {
			client.setQueryData(['space-junk-elements', day], text);
		},
		async show(iso: string, object: SpaceObject | undefined) {
			await act(async () =>
				root.render(
					<QueryClientProvider client={client}>
						<Positions iso={iso} object={object} />
					</QueryClientProvider>
				)
			);
			return container.querySelector('time')!;
		},
		async close() {
			await act(async () => root.unmount());
			client.clear();
		},
	};
}

it('propagates cached measurements in both directions, only during flight and within three days of measurement', async () => {
	const view = chart();
	try {
		view.archive('2006-08-02', tle);
		for (const iso of [
			'2006-07-31T23:59Z',
			'2006-08-01T23:59Z',
			'2006-08-03T00:00Z',
			'2006-08-03T00:01Z',
			'2006-08-05T00:01Z',
		]) {
			const rows = snapshotPositions(tle, new Date(iso));
			expect(rows).toHaveLength(1);
			const expected = rows[0]!.slice(1).join(',');
			expect((await view.show(iso, spatula)).textContent).toBe(expected);
			await act(async () => view.archive(iso.slice(0, 10), ''));
			expect((await view.show(iso, spatula)).textContent).toBe(expected);
		}
		// A neighboring file is no evidence of flight or of a recent measurement.
		for (const date of ['2006-08-02', '2006-08-03', '2006-08-04'])
			view.archive(date, date.endsWith('02') ? tle : '');
		expect(
			(
				await view.show('2006-08-03T00:00Z', {
					...spatula,
					end: '2006-08-03',
				})
			).textContent
		).toBe('');
		view.archive('2006-08-12', tle);
		for (const date of ['2006-08-13', '2006-08-14']) view.archive(date, '');
		expect(
			(await view.show('2006-08-13T00:00Z', spatula)).textContent
		).toBe('');
	} finally {
		await view.close();
	}
});

it('dates the last debris frame while the next archive loads and clears it on settled gaps or switch-off', async () => {
	jest.useFakeTimers();
	const view = chart();
	try {
		const original = '2006-08-02T12:00:00.000Z';
		const later = '2006-09-02T12:00:00.000Z';
		view.archive('2006-08-02', tle);
		const initial = (await view.show(original, spatula)).textContent;
		expect(initial).toBeTruthy();
		const held = await view.show(later, spatula);
		expect(held.dateTime).toBe(original);
		expect(held.textContent).toBe(initial);
		const newTle = tle.replace('06214.', '06245.');
		await act(async () => {
			view.archive('2006-09-02', newTle);
			await jest.advanceTimersByTimeAsync(1);
		});
		expect(held.dateTime).toBe(later);
		expect(held.textContent).toBe(
			snapshotPositions(newTle, new Date(later))[0]!.slice(1).join(',')
		);

		await view.show('2006-09-15T12:00Z', spatula);
		expect(held.dateTime).toBe(later);
		await act(async () => {
			for (const day of ['2006-09-14', '2006-09-15', '2006-09-16'])
				view.archive(day, '');
			await jest.advanceTimersByTimeAsync(1);
		});
		expect(held.textContent).toBe('');
		await view.show(original, spatula);
		await view.show(later, undefined);
		expect(held.textContent).toBe('');
		await view.show('2006-09-25T12:00Z', spatula);
		expect(held.textContent).toBe('');
	} finally {
		await view.close();
		jest.useRealTimers();
	}
});
