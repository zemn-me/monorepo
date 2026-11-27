import { expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { SpaceObject } from './chart.js';
import { spatula, tle } from './orbit_fixture.js';
import { snapshotPositions } from './orbit.js';
import { useDebrisPositions } from './use_debris_positions.js';

function Positions({ iso, objects }: { iso: string; objects: SpaceObject[] }) {
	const { markers, instant } = useDebrisPositions(
		objects.map(object => ({ object })),
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
		async show(iso: string, ...objects: SpaceObject[]) {
			await act(async () =>
				root.render(
					<QueryClientProvider client={client}>
						<Positions iso={iso} objects={objects} />
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

it('keeps a neighboring measurement when the filter broadens to include an exact-day object', async () => {
	const view = chart();
	try {
		const day = '2006-08-02';
		const iso = day + 'T12:00Z';
		const second = { ...spatula, id: 29258 };
		const secondTle = tle
			.replaceAll('29257', '29258')
			.replace('307.6701', '207.6701');
		const otherOrbit = tle.replace('307.6701', '107.6701');
		view.archive(day, tle);
		view.archive('2006-08-01', secondTle + '\n' + otherOrbit);
		const expected = snapshotPositions(
			secondTle + '\n' + tle,
			new Date(iso)
		).map(row => row.slice(1).join(','));
		expect((await view.show(iso, second)).textContent).toBe(expected[0]);
		expect((await view.show(iso, second, spatula)).textContent).toBe(
			expected.join(' ')
		);
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
		await view.show(later);
		expect(held.textContent).toBe('');
		await view.show('2006-09-25T12:00Z', spatula);
		expect(held.textContent).toBe('');
	} finally {
		await view.close();
		jest.useRealTimers();
	}
});

it('loads the neighboring archives ahead of a day change and reuses them when the ruler reverses', async () => {
	jest.useFakeTimers();
	const view = chart();
	const originalFetch = globalThis.fetch;
	const requests: string[] = [];
	const nextTle = tle.replace('307.6701', '207.6701');
	globalThis.fetch = async url => {
		const day = String(url).split('/').pop()!;
		requests.push(day);
		return {
			ok: true,
			text: async () => (day === '2006-08-03' ? nextTle : tle),
		} as Response;
	};
	const settle = () => act(async () => jest.advanceTimersByTimeAsync(1000));
	try {
		const noon = '2006-08-02T12:00Z';
		const nextNoon = '2006-08-03T12:00Z';
		await view.show(noon, spatula);
		await waitFor(() => expect(requests).toHaveLength(3));
		expect(requests.toSorted()).toEqual([
			'2006-08-01',
			'2006-08-02',
			'2006-08-03',
		]);

		const next = await view.show(nextNoon, spatula);
		expect(next.textContent).toBe(
			snapshotPositions(nextTle, new Date(nextNoon))[0]!
				.slice(1)
				.join(',')
		);
		await waitFor(() => expect(requests).toHaveLength(4));
		expect(requests.toSorted()).toEqual([
			'2006-08-01',
			'2006-08-02',
			'2006-08-03',
			'2006-08-04',
		]);

		await view.show(noon, spatula);
		await settle();
		expect(requests).toHaveLength(4);

		await view.show('2006-08-04T12:00Z', spatula);
		await view.show('2006-08-04T12:00Z');
		await settle();
		expect(requests).toHaveLength(4);
	} finally {
		await view.close();
		globalThis.fetch = originalFetch;
		jest.useRealTimers();
	}
});
