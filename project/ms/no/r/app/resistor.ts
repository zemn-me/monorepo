export interface ColourBand {
	readonly value: number;
	readonly colour: string;
	readonly label: string;
}

export const DIGIT_BANDS = [
	{ value: 0, colour: 'black', label: 'Black' },
	{ value: 1, colour: 'brown', label: 'Brown' },
	{ value: 2, colour: 'red', label: 'Red' },
	{ value: 3, colour: 'orange', label: 'Orange' },
	{ value: 4, colour: 'yellow', label: 'Yellow' },
	{ value: 5, colour: 'green', label: 'Green' },
	{ value: 6, colour: 'blue', label: 'Blue' },
	{ value: 7, colour: 'violet', label: 'Violet' },
	{ value: 8, colour: 'gray', label: 'Gray' },
	{ value: 9, colour: 'white', label: 'White' },
] as const satisfies readonly ColourBand[];

export const MULTIPLIER_BANDS = [
	...DIGIT_BANDS,
	{ value: -1, colour: 'gold', label: 'Gold' },
	{ value: -2, colour: 'silver', label: 'Silver' },
] as const satisfies readonly ColourBand[];

export const TOLERANCE_BANDS = [
	{ value: 1, colour: 'brown', label: 'Brown' },
	{ value: 2, colour: 'red', label: 'Red' },
	{ value: 0.5, colour: 'green', label: 'Green' },
	{ value: 0.25, colour: 'blue', label: 'Blue' },
	{ value: 0.1, colour: 'violet', label: 'Violet' },
	{ value: 0.05, colour: 'gray', label: 'Gray' },
	{ value: 5, colour: 'gold', label: 'Gold' },
	{ value: 10, colour: 'silver', label: 'Silver' },
	{ value: 20, colour: 'transparent', label: 'Transparent' },
] as const satisfies readonly ColourBand[];

export const COLOUR_VALUES: Record<string, string> = {
	brown: '#583a31',
	navy: '#001f3f',
	blue: '#0074d9',
	aqua: '#7fdbff',
	teal: '#39cccc',
	olive: '#3d9970',
	green: '#2ecc40',
	lime: '#01ff70',
	yellow: '#ffdc00',
	orange: '#ff851b',
	red: '#ff4136',
	fuchsia: '#f012be',
	purple: '#b10dc9',
	violet: '#b10dc9',
	maroon: '#85144b',
	white: '#ffffff',
	gray: '#aaaaaa',
	silver: '#dddddd',
	gold: '#aa967b',
	black: '#111111',
	transparent: 'transparent',
};

export interface ResistorCalculation {
	readonly resistance: number;
	readonly tolerance: number;
	readonly bands: readonly string[];
	readonly resistanceText: string;
}

export type CalculationResult =
	| {
			readonly ok: true;
			readonly value: ResistorCalculation;
	  }
	| {
			readonly ok: false;
			readonly message: string;
	  };

const numericColourByValue = new Map<number, string>(
	MULTIPLIER_BANDS.map(band => [band.value, band.colour])
);

const numericValueByColour = new Map<string, number>(
	MULTIPLIER_BANDS.map(band => [band.colour, band.value])
);

const toleranceColourByValue = new Map<number, string>(
	TOLERANCE_BANDS.map(band => [band.value, band.colour])
);

const toleranceValueByColour = new Map<string, number>(
	TOLERANCE_BANDS.map(band => [band.colour, band.value])
);

const digitValueByColour = new Map<string, number>(
	DIGIT_BANDS.map(band => [band.colour, band.value])
);

const SI_MULTIPLIERS = new Map<string, number>([
	['Y', 24],
	['yotta', 24],
	['Z', 21],
	['zetta', 21],
	['E', 18],
	['exa', 18],
	['P', 15],
	['peta', 15],
	['T', 12],
	['tera', 12],
	['G', 9],
	['giga', 9],
	['M', 6],
	['mega', 6],
	['k', 3],
	['kilo', 3],
	['h', 2],
	['hecto', 2],
	['da', 1],
	['deca', 1],
	['', 0],
	['d', -1],
	['deci', -1],
	['c', -2],
	['centi', -2],
	['m', -3],
	['mili', -3],
	['milli', -3],
	['u', -6],
	['micro', -6],
	['µ', -6],
	['μ', -6],
	['n', -9],
	['nano', -9],
	['p', -12],
	['pico', -12],
	['f', -15],
	['femto', -15],
	['a', -18],
	['atto', -18],
	['z', -21],
	['zepto', -21],
	['y', -24],
	['yocto', -24],
]);

const REALISTIC_SI_POWERS = [
	24, 21, 18, 15, 12, 9, 6, 3, 0, -3, -6, -9, -12, -15, -18, -21, -24,
];

const SI_LABEL_BY_POWER = new Map<number, string>([
	[24, 'Y'],
	[21, 'Z'],
	[18, 'E'],
	[15, 'P'],
	[12, 'T'],
	[9, 'G'],
	[6, 'M'],
	[3, 'k'],
	[0, ''],
	[-3, 'm'],
	[-6, 'µ'],
	[-9, 'n'],
	[-12, 'p'],
	[-15, 'f'],
	[-18, 'a'],
	[-21, 'z'],
	[-24, 'y'],
]);

const OHM_SUFFIX = /(?:ohms?|[ΩΩ])$/iu;

function roundIfClose(value: number): number | null {
	const rounded = Math.round(value);
	const tolerance = Math.max(1, Math.abs(value)) * Number.EPSILON * 64;

	return Math.abs(value - rounded) <= tolerance ? rounded : null;
}

function formatNumber(value: number): string {
	if (Number.isInteger(value)) {
		return String(value);
	}

	return value
		.toPrecision(6)
		.replace(/\.?0+$/u, '')
		.replace(/\.$/u, '');
}

export function colourValue(colour: string): string {
	return COLOUR_VALUES[colour] ?? colour;
}

export function colourLabel(colour: string): string {
	return `${colour.charAt(0).toUpperCase()}${colour.slice(1)}`;
}

export function normaliseColour(value: string): string {
	const normalized = value.trim().toLowerCase().replace(/\s+/gu, ' ');
	const aliases: Record<string, string> = {
		absent: 'transparent',
		clear: 'transparent',
		empty: 'transparent',
		grey: 'gray',
		none: 'transparent',
	};

	return aliases[normalized] ?? normalized;
}

export function parseTolerance(value: string): number | null {
	const parsed = Number(value.replace(/[±%\s]/gu, ''));

	return toleranceColourByValue.has(parsed) ? parsed : null;
}

export function parseResistance(value: string): number | null {
	const match =
		/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-zA-ZµμΩΩ ]*)\s*$/u.exec(
			value
		);

	if (match == null) {
		return null;
	}

	const magnitude = Number(match[1]);
	if (!Number.isFinite(magnitude) || magnitude < 0) {
		return null;
	}

	const unit = (match[2] ?? '')
		.trim()
		.replace(/\s+/gu, '')
		.replace(OHM_SUFFIX, '');
	const multiplier = SI_MULTIPLIERS.get(unit);
	if (multiplier == null) {
		return null;
	}

	return magnitude * Math.pow(10, multiplier);
}

export function formatResistance(resistance: number): string {
	if (!Number.isFinite(resistance)) {
		return '';
	}

	if (resistance === 0) {
		return '0';
	}

	const exponent = Math.floor(Math.log10(Math.abs(resistance)));
	const power =
		REALISTIC_SI_POWERS.find(candidate => candidate <= exponent) ??
		REALISTIC_SI_POWERS.at(-1)!;
	const unit = SI_LABEL_BY_POWER.get(power) ?? '';

	return `${formatNumber(resistance / Math.pow(10, power))}${unit}`;
}

export function encodeResistor(
	resistance: number,
	tolerance: number
): CalculationResult {
	const toleranceColour = toleranceColourByValue.get(tolerance);
	if (toleranceColour == null) {
		return { ok: false, message: 'Invalid tolerance' };
	}

	if (!Number.isFinite(resistance) || resistance < 0) {
		return { ok: false, message: 'Invalid resistance' };
	}

	if (resistance === 0) {
		return {
			ok: true,
			value: {
				resistance,
				tolerance,
				bands: ['black', 'black', 'black', toleranceColour],
				resistanceText: formatResistance(resistance),
			},
		};
	}

	for (let multiplier = 9; multiplier >= -2; multiplier -= 1) {
		const significant = roundIfClose(
			resistance / Math.pow(10, multiplier)
		);

		if (significant == null || significant < 1) {
			continue;
		}

		let digits = String(significant);
		let adjustedMultiplier = multiplier;

		if (digits.length < 2) {
			digits = `${digits}0`;
			adjustedMultiplier -= 1;
		}

		const multiplierColour = numericColourByValue.get(adjustedMultiplier);
		if (multiplierColour == null || /[^0-9]/u.test(digits)) {
			continue;
		}

		const digitColours: string[] = [];
		for (const digit of digits) {
			const colour = numericColourByValue.get(Number(digit));
			if (colour == null) {
				continue;
			}
			digitColours.push(colour);
		}

		if (digitColours.length !== digits.length) {
			continue;
		}

		return {
			ok: true,
			value: {
				resistance,
				tolerance,
				bands: [...digitColours, multiplierColour, toleranceColour],
				resistanceText: formatResistance(resistance),
			},
		};
	}

	return { ok: false, message: 'Resistance cannot be represented' };
}

export function decodeBands(bands: readonly string[]): CalculationResult {
	const normalizedBands = bands.map(normaliseColour);
	if (normalizedBands.length < 4) {
		return { ok: false, message: 'At least four bands are required' };
	}

	const toleranceColour = normalizedBands.at(-1)!;
	const tolerance = toleranceValueByColour.get(toleranceColour);
	if (tolerance == null) {
		return { ok: false, message: 'Invalid tolerance band' };
	}

	const multiplierColour = normalizedBands.at(-2)!;
	const multiplier = numericValueByColour.get(multiplierColour);
	if (multiplier == null) {
		return { ok: false, message: 'Invalid multiplier band' };
	}

	const digitValues = normalizedBands
		.slice(0, -2)
		.map(colour => digitValueByColour.get(colour));
	if (
		digitValues.some(value => value == null) ||
		digitValues.length < 2
	) {
		return { ok: false, message: 'Invalid digit band' };
	}

	const significant = Number(digitValues.join(''));
	const resistance = significant * Math.pow(10, multiplier);

	return {
		ok: true,
		value: {
			resistance,
			tolerance,
			bands: normalizedBands,
			resistanceText: formatResistance(resistance),
		},
	};
}
