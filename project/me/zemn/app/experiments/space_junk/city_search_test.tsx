import { expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { type City, cityShard, nameShard } from './cities.js';

jest.unstable_mockModule('./style.module.css', () => ({ default: {} }));
const { CitySearch } = await import('./city_search.js');

function Picker() {
	const [city, setCity] = useState<City>();
	return <CitySearch city={city} onSelect={setCity} />;
}

function searchLondon() {
	const client = new QueryClient();
	client.setQueryData(cityShard(nameShard('lo')).queryKey, [
		[
			2643743,
			'London',
			'England',
			'United Kingdom',
			51.5,
			-0.12,
			'Europe/London',
			['london'],
			'Europe/London',
		],
	]);
	render(
		<QueryClientProvider client={client}>
			<Picker />
			<button type="button">Next control</button>
		</QueryClientProvider>
	);
	const input = screen.getByRole<HTMLInputElement>('combobox', {
		name: 'City',
	});
	act(() => input.focus());
	fireEvent.change(input, { target: { value: 'Lon' } });
	return {
		input,
		london: screen.getByRole('option', {
			name: 'London, England, United Kingdom',
		}),
	};
}

it('selects the tapped city when Safari blurs the input before click', () => {
	const { input, london } = searchLondon();
	fireEvent.pointerDown(london, { pointerType: 'touch' });
	act(() => input.blur());
	fireEvent.pointerUp(london, { pointerType: 'touch' });
	fireEvent.click(london);
	expect(input.value).toBe('London, England, United Kingdom');
	expect(screen.queryByRole('option')).toBeNull();
});

it('leaves a cancelled touch unselected and dismisses on an outside tap', () => {
	const { input, london } = searchLondon();
	fireEvent.pointerDown(london, { pointerType: 'touch' });
	act(() => input.blur());
	fireEvent.pointerCancel(london, { pointerType: 'touch' });
	expect(input.value).toBe('Lon');
	fireEvent.pointerDown(document.body, { pointerType: 'touch' });
	expect(input.value).toBe('');
	expect(screen.queryByRole('option')).toBeNull();
});

it('dismisses the results when keyboard focus moves outside the picker', () => {
	const { input } = searchLondon();
	act(() => screen.getByRole('button', { name: 'Next control' }).focus());
	expect(input.value).toBe('');
	expect(screen.queryByRole('option')).toBeNull();
});
