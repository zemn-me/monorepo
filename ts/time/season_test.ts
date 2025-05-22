
import { expect, it } from '@jest/globals';

import * as season from '#root/ts/time/season.js';


it('should detect winter in the new york in January', () => {
	expect(season.getSeason(new Date('2023-01-01'),
		"America/New_York"
	)).toBe(season.winter);
});

it('should detect summer in sydney in January', () => {
	expect(season.getSeason(new Date('2023-01-01'),
		"Australia/Sydney"
	)).toBe(season.summer);
});

it('should detect summer in auckland in January', () => {
	expect(season.getSeason(new Date('2023-01-01'),
		"Pacific/Auckland"
	)).toBe(season.summer);
});

it('should detect autumn in auckland in May', () => {
	expect(season.getSeason(new Date('2023-05-01'),
		"Pacific/Auckland"
	)).toBe(season.autumn);
});
