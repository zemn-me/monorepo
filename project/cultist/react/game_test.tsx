import { beforeAll, describe, expect, test } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react';

import type { CoreContent } from '#root/project/cultist/content.js';
import { loadCoreContent } from '#root/project/cultist/content_node.js';
import { CultistGame } from '#root/project/cultist/react/game.js';

let core: CoreContent;

beforeAll(async () => {
	core = await loadCoreContent();
});

function complete(label: string) {
	fireEvent.click(screen.getByRole('button', { name: `Start ${label}` }));
	fireEvent.click(screen.getByRole('button', { name: 'Resolve next' }));
}

function listItemFor(element: HTMLElement): HTMLElement {
	const item = element.closest('li');
	if (item === null) throw new Error('Expected element to be inside a log item.');
	return item;
}

function logItemContaining(history: HTMLElement, text: string): HTMLElement {
	const item = Array.from(history.querySelectorAll('li')).find(item =>
		item.textContent?.includes(text)
	);
	if (item === undefined) throw new Error(`Expected history item for ${text}.`);
	return item;
}

describe('CultistGame', () => {
	test('starts from official Aspirant content', () => {
		render(<CultistGame core={core} />);

		expect(screen.getByText('The Aspirant')).toBeDefined();
		expect(screen.getByText('Menial Employment')).toBeDefined();
		expect(
			screen.getByRole('button', {
				name: 'Start Another Shift at the Hospital',
			})
		).toBeDefined();
		expect(screen.queryByText('The Locksmith Dreamed')).toEqual(null);
	});

	test('history shows official recipe inputs and outputs with card tooltips', () => {
		render(<CultistGame core={core} />);

		complete('Another Shift at the Hospital');
		complete('Examine the Bequest, employing Reason');

		const history = screen.getByRole('heading', { name: 'History' })
			.parentElement;
		if (history === null) throw new Error('History panel was not rendered.');

			expect(history.textContent).toContain('Triggered by Recall my Dreams');
			expect(history.textContent).toContain('Linked from A Change in the Air');

			const startEntry = logItemContaining(history, 'A Bequest');
			expect(within(startEntry).getByText('In')).toBeDefined();
			const bequest = within(startEntry).getAllByText('A Bequest')[0];
			if (bequest === undefined) throw new Error('Expected A Bequest in history.');
			fireEvent.mouseOver(bequest);
		expect(
			within(startEntry)
				.getAllByRole('tooltip')
				.map(tooltip => tooltip.textContent)
				.join(' ')
		).toContain('I must STUDY it, using either Passion or Reason.');

		const resultEntry = listItemFor(
			within(history).getByText(/My correspondent describes my dreams exactly/)
		);
		expect(within(resultEntry).getByText('Out')).toBeDefined();
		expect(
			within(resultEntry).getAllByText("A Watchman's Secret").length
		).toBeGreaterThan(0);
		expect(
			within(resultEntry)
				.getAllByRole('tooltip')
				.map(tooltip => tooltip.textContent)
				.join(' ')
		).toContain('Each Hour has its colour');
	});
});
