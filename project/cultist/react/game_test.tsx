import { describe, expect, test } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { CultistGame } from '#root/project/cultist/react/game.js';

function complete(label: string) {
	fireEvent.click(screen.getByRole('button', { name: `Start ${label}` }));
	fireEvent.click(screen.getByRole('button', { name: 'Resolve next' }));
}

function listItemFor(element: HTMLElement): HTMLElement {
	const item = element.closest('li');
	if (item === null) throw new Error('Expected element to be inside a log item.');
	return item;
}

describe('CultistGame', () => {
	test('the browser surface can play to an Enlightenment ending', () => {
		const { container } = render(<CultistGame />);

		for (let i = 0; i < 4; i++) complete('A day of labour');

		complete('Open the bequest');
		complete('Read The Locksmith Dreamed');
		complete('Dream of a watchful principle');
		complete('Walk the moonlit streets');
		complete('Discipline reason');
		complete('Compare Watchful Principles');
		complete('Found a Lantern society');
		complete('Dedicate the desire');
		complete('Discipline reason');
		complete('Codify the White Door');
		complete('Recruit a Lantern disciple');
		complete('Find a room for rites');
		complete('Pass the White Door');
		complete('Follow a glimmering');
		complete('Draw a bright influence');
		complete('Follow a glimmering');
		complete('Draw a bright influence');
		complete('Discipline reason');
		complete('Map the Glory through glass');
		complete('Open the inward eye');
		complete('Discipline reason');
		complete('Compile The Sun Unsubtle');
		complete('Prepare the last brightness');
		complete('Invoke the Watchman');

		expect(screen.getByText('Enlightenment')).toBeDefined();
		expect(screen.getAllByText('The Sun Unsubtle').length).toBeGreaterThan(0);
		expect(container.querySelector('img')).toEqual(null);
	});

	test('history shows recipe cards with detail tooltips', () => {
		render(<CultistGame />);

		complete('Open the bequest');

		const history = screen.getByRole('heading', { name: 'History' })
			.parentElement;
		if (history === null) throw new Error('History panel was not rendered.');

		const startEntry = listItemFor(
			within(history).getByText('The papers smell of dust and fever.')
		);
		expect(within(startEntry).getByText('In')).toBeDefined();
		fireEvent.mouseOver(within(startEntry).getAllByText('A Bequest')[0]);
		expect(within(startEntry).getByRole('tooltip').textContent).toContain(
			'A box of papers from an acquaintance now absent.'
		);

		const resultEntry = listItemFor(
			within(history).getByText(
				'Among the papers is a book and the first useful hint.'
			)
		);
		expect(within(resultEntry).getByText('Out')).toBeDefined();
		expect(
			within(resultEntry).getAllByText('The Locksmith Dreamed').length
		).toBeGreaterThan(0);
		expect(
			within(resultEntry).getAllByText('A Watchful Principle').length
		).toBeGreaterThan(0);
		expect(
			within(resultEntry)
				.getAllByRole('tooltip')
				.map(tooltip => tooltip.textContent)
				.join(' ')
		).toContain('A slim, coded book about doors that open in sleep.');
	});
});
