import { describe, expect, it } from '@jest/globals';

import {
	LDMLFieldToken,
	LDMLLiteralToken,
	LDMLSyntaxError,
	compileLDML,
	createFieldToken,
	createLiteralToken,
	parseLDML,
	stringifyLDML,
} from '#root/ts/ldml/index.js';

describe('parseLDML', () => {
	it('tokenises common date format patterns with precise typing', () => {
		const tokens = parseLDML('yyyy-MM-dd');
		const typed: readonly [
			LDMLFieldToken<'y', 4, 'yyyy'>,
			LDMLLiteralToken<'-'>,
			LDMLFieldToken<'M', 2, 'MM'>,
			LDMLLiteralToken<'-'>,
			LDMLFieldToken<'d', 2, 'dd'>,
		] = tokens;
		expect(typed).toHaveLength(5);
		expect(typed[0]).toMatchObject({ symbol: 'y', length: 4 });
		expect(typed[1]).toMatchObject({ kind: 'literal', value: '-' });
		expect(typed[2]).toMatchObject({ symbol: 'M', length: 2 });
		expect(typed[4]).toMatchObject({ symbol: 'd', length: 2 });
	});

	it('parses quoted literals correctly', () => {
		const tokens = parseLDML("'at' HH:mm");
		const typed: readonly [
			LDMLLiteralToken<'at'>,
			LDMLLiteralToken<' '>,
			LDMLFieldToken<'H', 2, 'HH'>,
			LDMLLiteralToken<':'>,
			LDMLFieldToken<'m', 2, 'mm'>,
		] = tokens;
		expect(typed).toHaveLength(5);
		expect(typed[0]).toMatchObject({ quoted: true, raw: "'at'" });
		expect(typed[1]).toMatchObject({ value: ' ' });
		expect(typed[2]).toMatchObject({ symbol: 'H', length: 2 });
	});

	it('preserves doubled apostrophes as single literal apostrophe', () => {
		const [token] = parseLDML("h 'o''clock'");
		const typed: readonly [
			LDMLFieldToken<'h', 1, 'h'>,
			LDMLLiteralToken<' '>,
			LDMLLiteralToken<"o'clock">,
		] = parseLDML("h 'o''clock'");
		expect(typed[2]).toMatchObject({ value: "o'clock", quoted: true });

		expect(token.kind).toBe('field');
	});

	it('throws on invalid field length', () => {
		expect(() => parseLDML('MMMMMM')).toThrow(LDMLSyntaxError);
	});

	it('throws on unterminated literal', () => {
		expect(() => parseLDML("'missing")).toThrow(LDMLSyntaxError);
	});
});

describe('stringifyLDML', () => {
	it('round-trips parsed patterns', () => {
		const patterns = ["yyyy-MM-dd'T'HH:mm:ssXXX", "'week' w 'of' Y"];
		for (const pattern of patterns) {
			const tokens = parseLDML(pattern);
			expect(stringifyLDML(tokens)).toBe(pattern);
		}
	});
});

describe('helpers', () => {
	it('creates field tokens with validation', () => {
		const token = createFieldToken('H', 2);
		const typed: LDMLFieldToken<'H', 2, 'HH'> = token;
		expect(typed.raw).toBe('HH');
		expect(() => createFieldToken('M', 9 as any)).toThrow(LDMLSyntaxError);
	});

	it('creates literal tokens that quote when needed', () => {
		const literal = createLiteralToken(' at ');
		expect(literal.quoted).toBe(true);
		expect(literal.raw).toBe("' at '");

		const slash = createLiteralToken('/');
		expect(slash.quoted).toBe(false);
		expect(slash.raw).toBe('/');
	});

	it('compiles mixed tokens back into a pattern', () => {
		const built = compileLDML([
			createFieldToken('y', 4),
			createLiteralToken('-'),
			createFieldToken('M', 2),
			createLiteralToken('-'),
			createFieldToken('d', 2),
			createLiteralToken(' at '),
			createFieldToken('H', 2),
			createLiteralToken(':'),
			createFieldToken('m', 2),
		]);
		expect(built).toBe("yyyy-MM-dd' at 'HH:mm");
	});
});
