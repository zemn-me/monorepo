import { afterEach, beforeAll, expect, it, jest } from '@jest/globals';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { Temporal } from 'temporal-polyfill';

import { resolve } from '#root/ts/future/future.js';

jest.unstable_mockModule(
	'#root/project/me/zemn/app/availability/page.module.css',
	() => ({
		default: { busy: 'busy', dayHeader: 'dayHeader' },
	})
);

// The event crosses the calendar's 05:00 day boundary.
const calendar = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260917T043000Z
DTEND:20260917T053000Z
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260916
DTEND;VALUE=DATE:20260917
END:VEVENT
END:VCALENDAR`;
jest.unstable_mockModule('#root/project/me/zemn/hook/useZemnMeApi.js', () => ({
	useGetCalendarICals: () => [resolve(calendar)],
}));

let AvailabilityClient: () => JSX.Element;
beforeAll(async () => {
	AvailabilityClient = (await import('./client.js')).AvailabilityClient;
});
afterEach(() => {
	jest.restoreAllMocks();
});

it('renders day labels and clips a busy event into adjacent calendar columns', () => {
	jest.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(
		Temporal.ZonedDateTime.from('2026-09-16T12:00:00+00:00[UTC]')
	);
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	try {
		act(() => root.render(<AvailabilityClient />));
		const grid = container.querySelector(
			'section[aria-label="Availability calendar"]'
		)!;
		const headers = grid.querySelectorAll('header');
		expect(headers).toHaveLength(63);
		expect(headers[0]!.textContent).toContain('Wednesday');
		expect(headers[0]!.textContent).toContain('16');
		const blocks = [...grid.querySelectorAll<HTMLElement>('.busy')];
		expect(blocks).toHaveLength(2);
		expect(blocks.map(block => block.style.gridColumn)).toEqual(['2', '3']);
		expect(blocks.map(block => block.style.gridRow)).toEqual([
			'1413 / 1443',
			'3 / 33',
		]);
		expect(blocks[0]!.textContent).toBe(blocks[1]!.textContent);
	} finally {
		act(() => root.unmount());
		container.remove();
	}
});
