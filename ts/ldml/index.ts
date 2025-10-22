type FieldLengthInfo = {
	readonly summary: string;
	readonly notes?: string;
};

type FieldDefinition = {
	readonly category: string;
	readonly description: string;
	readonly minLength: number;
	readonly maxLength: number;
	readonly lengthInfo: Readonly<Record<number, FieldLengthInfo>>;
	readonly fallback?: FieldLengthInfo;
	readonly allowedLengths?: readonly number[];
	readonly deprecated?: boolean;
	readonly skeletonOnly?: boolean;
};

const MAX_EXPANDED_LENGTH = 20 as const;

export const LDML_FIELDS = {
	G: {
		category: 'era',
		description: 'Era designator.',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'abbreviated' },
			2: { summary: 'abbreviated' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
		},
	} satisfies FieldDefinition,
	y: {
		category: 'year',
		description: 'Calendar year.',
		minLength: 1,
		maxLength: MAX_EXPANDED_LENGTH,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: '2-digit year (low-order digits)' },
			3: { summary: 'numeric (minimum digits)' },
			4: { summary: 'numeric (minimum digits)' },
		},
		fallback: { summary: 'numeric (minimum digits)' },
	},
	Y: {
		category: 'year',
		description: 'Week-of-year based year.',
		minLength: 1,
		maxLength: MAX_EXPANDED_LENGTH,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: '2-digit year (low-order digits)' },
			3: { summary: 'numeric (minimum digits)' },
			4: { summary: 'numeric (minimum digits)' },
		},
		fallback: { summary: 'numeric (minimum digits)' },
	},
	u: {
		category: 'year',
		description: 'Extended year (spanning eras).',
		minLength: 1,
		maxLength: MAX_EXPANDED_LENGTH,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
		},
		fallback: { summary: 'numeric (minimum digits)' },
	},
	U: {
		category: 'year',
		description: 'Cyclic year name.',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'abbreviated' },
			2: { summary: 'abbreviated' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
		},
	},
	r: {
		category: 'year',
		description: 'Related Gregorian year.',
		minLength: 1,
		maxLength: MAX_EXPANDED_LENGTH,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
		},
		fallback: { summary: 'numeric (minimum digits)' },
	},
	Q: {
		category: 'quarter',
		description: 'Quarter number/name (format style).',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'numeric (1 digit)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
		},
	},
	q: {
		category: 'quarter',
		description: 'Quarter number/name (stand-alone style).',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'numeric (1 digit)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
		},
	},
	M: {
		category: 'month',
		description: 'Month number/name (format style).',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
		},
	},
	L: {
		category: 'month',
		description: 'Month number/name (stand-alone style).',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
		},
	},
	l: {
		category: 'month',
		description: 'Deprecated leap month marker placeholder.',
		minLength: 1,
		maxLength: 1,
		lengthInfo: {
			1: { summary: 'deprecated' },
		},
		deprecated: true,
	},
	w: {
		category: 'week',
		description: 'Week of year (numeric).',
		minLength: 1,
		maxLength: 2,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
		},
	},
	W: {
		category: 'week',
		description: 'Week of month (numeric).',
		minLength: 1,
		maxLength: 1,
		lengthInfo: {
			1: { summary: 'numeric (1 digit)' },
		},
	},
	d: {
		category: 'day',
		description: 'Day of month (numeric).',
		minLength: 1,
		maxLength: 2,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
		},
	},
	D: {
		category: 'day',
		description: 'Day of year (numeric).',
		minLength: 1,
		maxLength: 3,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (minimum digits)' },
			3: { summary: 'numeric (minimum digits)' },
		},
		fallback: { summary: 'numeric (minimum digits)' },
	},
	F: {
		category: 'day',
		description: 'Day of week in month.',
		minLength: 1,
		maxLength: 1,
		lengthInfo: {
			1: { summary: 'numeric (1 digit)' },
		},
	},
	g: {
		category: 'day',
		description: 'Modified Julian day.',
		minLength: 1,
		maxLength: MAX_EXPANDED_LENGTH,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
		},
		fallback: { summary: 'numeric (minimum digits)' },
	},
	E: {
		category: 'weekday',
		description: 'Day of week name (format style).',
		minLength: 1,
		maxLength: 6,
		lengthInfo: {
			1: { summary: 'abbreviated' },
			2: { summary: 'abbreviated' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
			6: { summary: 'short' },
		},
	},
	e: {
		category: 'weekday',
		description: 'Local day of week number/name (format style).',
		minLength: 1,
		maxLength: 6,
		lengthInfo: {
			1: { summary: 'numeric (1 digit)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
			6: { summary: 'short' },
		},
	},
	c: {
		category: 'weekday',
		description: 'Local day of week number/name (stand-alone).',
		minLength: 1,
		maxLength: 6,
		lengthInfo: {
			1: { summary: 'numeric (1 digit)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
			6: { summary: 'short' },
		},
	},
	a: {
		category: 'period',
		description: 'AM/PM marker.',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'abbreviated' },
			2: { summary: 'abbreviated' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
		},
	},
	b: {
		category: 'period',
		description: 'Flexible day period (am, pm, noon, midnight).',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'abbreviated' },
			2: { summary: 'abbreviated' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
		},
	},
	B: {
		category: 'period',
		description: 'Flexible day period (general daypart).',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'abbreviated' },
			2: { summary: 'abbreviated' },
			3: { summary: 'abbreviated' },
			4: { summary: 'wide' },
			5: { summary: 'narrow' },
		},
	},
	h: {
		category: 'hour',
		description: 'Hour [1-12].',
		minLength: 1,
		maxLength: 2,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
		},
	},
	H: {
		category: 'hour',
		description: 'Hour [0-23].',
		minLength: 1,
		maxLength: 2,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
		},
	},
	K: {
		category: 'hour',
		description: 'Hour [0-11].',
		minLength: 1,
		maxLength: 2,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
		},
	},
	k: {
		category: 'hour',
		description: 'Hour [1-24].',
		minLength: 1,
		maxLength: 2,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
		},
	},
	j: {
		category: 'hour',
		description: 'Preferred hour format request (skeleton only).',
		minLength: 1,
		maxLength: 6,
		lengthInfo: {
			1: { summary: 'preferred hour (numeric)' },
			2: { summary: 'preferred hour (2 digits)' },
			3: { summary: 'preferred hour with wide day period' },
			4: { summary: 'preferred hour (2 digits) with wide day period' },
			5: { summary: 'preferred hour with narrow day period' },
			6: { summary: 'preferred hour (2 digits) with narrow day period' },
		},
		skeletonOnly: true,
	},
	J: {
		category: 'hour',
		description: 'Preferred hour format without day period (skeleton only).',
		minLength: 1,
		maxLength: 2,
		lengthInfo: {
			1: { summary: 'preferred hour (numeric)' },
			2: { summary: 'preferred hour (2 digits)' },
		},
		skeletonOnly: true,
	},
	C: {
		category: 'hour',
		description: 'Preferred hour with flexible day period (skeleton only).',
		minLength: 1,
		maxLength: 6,
		lengthInfo: {
			1: { summary: 'preferred hour + abbreviated day period' },
			2: { summary: 'preferred hour (2 digits) + abbreviated day period' },
			3: { summary: 'preferred hour + wide day period' },
			4: { summary: 'preferred hour (2 digits) + wide day period' },
			5: { summary: 'preferred hour + narrow day period' },
			6: { summary: 'preferred hour (2 digits) + narrow day period' },
		},
		skeletonOnly: true,
	},
	m: {
		category: 'minute',
		description: 'Minute (numeric).',
		minLength: 1,
		maxLength: 2,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
		},
	},
	s: {
		category: 'second',
		description: 'Second (numeric).',
		minLength: 1,
		maxLength: 2,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
			2: { summary: 'numeric (2 digits, zero padded)' },
		},
	},
	S: {
		category: 'second',
		description: 'Fractional seconds.',
		minLength: 1,
		maxLength: 12,
		lengthInfo: {
			1: { summary: 'fractional seconds (precision = length)' },
		},
		fallback: { summary: 'fractional seconds (precision = length)' },
	},
	A: {
		category: 'second',
		description: 'Milliseconds in day.',
		minLength: 1,
		maxLength: 8,
		lengthInfo: {
			1: { summary: 'numeric (minimum digits)' },
		},
		fallback: { summary: 'numeric (minimum digits)' },
	},
	z: {
		category: 'zone',
		description: 'Specific non-location time zone.',
		minLength: 1,
		maxLength: 4,
		lengthInfo: {
			1: { summary: 'short specific (fallback localized GMT)' },
			2: { summary: 'short specific (fallback localized GMT)' },
			3: { summary: 'short specific (fallback localized GMT)' },
			4: { summary: 'long specific (fallback specific location/GMT)' },
		},
	},
	Z: {
		category: 'zone',
		description: 'ISO8601 / localized GMT.',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'ISO 8601 basic (hours, optional minutes)' },
			2: { summary: 'ISO 8601 basic (hours, minutes)' },
			3: { summary: 'ISO 8601 basic (hours, minutes)' },
			4: { summary: 'long localized GMT' },
			5: { summary: 'ISO 8601 extended (hours, minutes, optional seconds)' },
		},
	},
	O: {
		category: 'zone',
		description: 'Localized GMT format.',
		minLength: 1,
		maxLength: 4,
		allowedLengths: [1, 4],
		lengthInfo: {
			1: { summary: 'short localized GMT' },
			4: { summary: 'long localized GMT' },
		},
	},
	v: {
		category: 'zone',
		description: 'Generic non-location format.',
		minLength: 1,
		maxLength: 4,
		allowedLengths: [1, 4],
		lengthInfo: {
			1: { summary: 'short generic non-location' },
			4: { summary: 'long generic non-location' },
		},
	},
	V: {
		category: 'zone',
		description: 'Time zone ID / exemplar city.',
		minLength: 1,
		maxLength: 4,
		lengthInfo: {
			1: { summary: 'short time zone ID' },
			2: { summary: 'long time zone ID' },
			3: { summary: 'exemplar city' },
			4: { summary: 'generic location format' },
		},
	},
	X: {
		category: 'zone',
		description: 'ISO8601 with Z for UTC.',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'ISO 8601 basic (hours, optional minutes) with Z' },
			2: { summary: 'ISO 8601 basic (hours, minutes) with Z' },
			3: { summary: 'ISO 8601 extended (hours, minutes) with Z' },
			4: { summary: 'ISO 8601 basic (hours, minutes, optional seconds) with Z' },
			5: { summary: 'ISO 8601 extended (hours, minutes, optional seconds) with Z' },
		},
	},
	x: {
		category: 'zone',
		description: 'ISO8601 without Z for UTC.',
		minLength: 1,
		maxLength: 5,
		lengthInfo: {
			1: { summary: 'ISO 8601 basic (hours, optional minutes)' },
			2: { summary: 'ISO 8601 basic (hours, minutes)' },
			3: { summary: 'ISO 8601 extended (hours, minutes)' },
			4: { summary: 'ISO 8601 basic (hours, minutes, optional seconds)' },
			5: { summary: 'ISO 8601 extended (hours, minutes, optional seconds)' },
		},
	},
} as const satisfies Record<string, FieldDefinition>;

export type FieldSymbol = keyof typeof LDML_FIELDS;

type FieldMeta<S extends FieldSymbol> = (typeof LDML_FIELDS)[S];

type EnumerateInternal<
	N extends number,
	Acc extends number[] = [],
> = Acc['length'] extends N ? Acc[number] : EnumerateInternal<N, [...Acc, Acc['length']]>;

type Enumerate<N extends number> = EnumerateInternal<N>;

type RangeInclusive<F extends number, T extends number> = F extends T ? F : Exclude<Enumerate<T>, Enumerate<F>> | T;

type AllowedLengths<S extends FieldSymbol> =
	FieldMeta<S>['allowedLengths'] extends readonly number[]
		? FieldMeta<S>['allowedLengths'][number]
		: RangeInclusive<FieldMeta<S>['minLength'], FieldMeta<S>['maxLength']>;

type BuildArray<Length extends number, Acc extends unknown[] = []> = Acc['length'] extends Length
	? Acc
	: BuildArray<Length, [...Acc, unknown]>;

type Decrement<N extends number> = BuildArray<N> extends [...infer Rest, unknown] ? Rest['length'] : never;

type RepeatCharInternal<
	Char extends string,
	Count extends number,
	Acc extends string = '',
> = Count extends 0 ? Acc : RepeatCharInternal<Char, Decrement<Count>, `${Acc}${Char}`>;

type RepeatChar<Char extends string, Count extends number> = Count extends number
	? RepeatCharInternal<Char, Count>
	: never;

export type FieldString<S extends FieldSymbol> = RepeatChar<S, AllowedLengths<S>>;

type FirstChar<S extends string> = S extends `${infer F}${string}` ? F : never;

type StringToTuple<S extends string, Acc extends unknown[] = []> = S extends `${string & infer _Head}${infer Rest}`
	? StringToTuple<Rest, [...Acc, unknown]>
	: Acc;

type StringLength<S extends string> = StringToTuple<S>['length'];

export type FieldLengthMetadata<S extends FieldSymbol, L extends number> =
	`${L}` extends keyof FieldMeta<S>['lengthInfo']
		? FieldMeta<S>['lengthInfo'][`${L}`]
		: FieldMeta<S>['fallback'] extends FieldLengthInfo
			? FieldMeta<S>['fallback']
			: never;

export type LDMLFieldToken<
	S extends FieldSymbol = FieldSymbol,
	L extends number = number,
	Raw extends string = string,
> = {
	readonly kind: 'field';
	readonly symbol: S;
	readonly length: L;
	readonly raw: Raw;
	readonly definition: FieldMeta<S>;
	readonly presentation: FieldLengthMetadata<S, L>;
};

export type LDMLLiteralToken<Raw extends string = string> = {
	readonly kind: 'literal';
	readonly value: Raw;
	readonly raw: string;
	readonly quoted: boolean;
};

export type LDMLToken = LDMLFieldToken | LDMLLiteralToken;

type ParseQuoted<
	S extends string,
	Acc extends string = '',
> = S extends `${infer Char}${infer Rest}`
	? Char extends "'"
		? Rest extends `${infer Next}${infer After}`
			? Next extends "'"
				? ParseQuoted<After, `${Acc}'`>
				: [Acc, Rest]
			: never
		: ParseQuoted<Rest, `${Acc}${Char}`>
	: never;

type ParseLiteral<
	S extends string,
	Acc extends string = '',
> = S extends `${infer Char}${infer Rest}`
	? Char extends "'" | FieldSymbol
		? [Acc, S]
		: ParseLiteral<Rest, `${Acc}${Char}`>
	: [Acc, ''];

type ParseFieldRun<
	S extends string,
	Acc extends string,
	Char extends string,
> = S extends `${Char}${infer Rest}` ? ParseFieldRun<Rest, `${Acc}${Char}`, Char> : [Acc, S];

type ParseField<S extends string> = S extends `${infer Char}${infer Rest}`
	? Char extends FieldSymbol
		? ParseFieldRun<Rest, `${Char}`, Char>
		: never
	: never;

type AppendToken<
	Acc extends readonly LDMLToken[],
	Token extends LDMLToken,
> = readonly [...Acc, Token];

type LiteralTokenFromValue<Value extends string, Raw extends string, Quoted extends boolean> = {
	readonly kind: 'literal';
	readonly value: Value;
	readonly raw: Raw;
	readonly quoted: Quoted;
};

type FieldTokenFromRaw<Raw extends string> = FirstChar<Raw> extends infer Symbol extends FieldSymbol
	? LDMLFieldToken<Symbol, StringLength<Raw>, Raw>
	: never;

export type ParseLDML<
	Input extends string,
	Acc extends readonly LDMLToken[] = readonly [],
> = Input extends ''
	? Acc
	: Input extends `'${infer AfterQuote}`
		? ParseQuoted<AfterQuote> extends [infer Literal extends string, infer Rest extends string]
			? ParseLDML<Rest, AppendToken<Acc, LiteralTokenFromValue<Literal, `'${Literal}'`, true>>>
			: never
		: Input extends `${infer Char}${infer Rest}`
			? Char extends FieldSymbol
				? ParseField<Input> extends [infer Raw extends string, infer Remaining extends string]
					? ParseLDML<Remaining, AppendToken<Acc, FieldTokenFromRaw<Raw>>>
					: never
				: ParseLiteral<Input> extends [infer Literal extends string, infer Remaining extends string]
					? ParseLDML<
						Remaining,
						AppendToken<Acc, LiteralTokenFromValue<Literal, Literal, false>>
					>
					: never
			: Acc;

const FIELD_SYMBOL_SET = new Set<FieldSymbol>(Object.keys(LDML_FIELDS) as FieldSymbol[]);

export const LDML_SYMBOLS = Object.keys(LDML_FIELDS) as FieldSymbol[];

const literalNeedsQuoting = (value: string): boolean =>
	value.length === 0 || value.split('').some(ch => ch === "'" || FIELD_SYMBOL_SET.has(ch as FieldSymbol));

const escapeLiteral = (value: string): string => value.replace(/'/g, "''");

const validateLength = (symbol: FieldSymbol, length: number): void => {
	const definition = LDML_FIELDS[symbol];
	const allowedSet = definition.allowedLengths;
	if (allowedSet) {
		if (!allowedSet.includes(length)) {
			throw new LDMLSyntaxError(
				`Field "${symbol}" does not support length ${length}. Allowed lengths: ${allowedSet.join(', ')}`,
			);
		}
		return;
	}
	if (length < definition.minLength || length > definition.maxLength) {
		throw new LDMLSyntaxError(
			`Field "${symbol}" length must be between ${definition.minLength} and ${definition.maxLength}.`,
		);
	}
};

const materializeFieldToken = (raw: string): LDMLFieldToken => {
	const symbol = raw[0] as FieldSymbol;
	const length = raw.length;
	validateLength(symbol, length);
	const definition = LDML_FIELDS[symbol];
	const presentation =
		definition.lengthInfo[length as keyof typeof definition.lengthInfo] ?? definition.fallback;
	if (!presentation) {
		throw new LDMLSyntaxError(
			`No presentation metadata for ${symbol.repeat(length)} (length ${length}).`,
		);
	}
	return {
		kind: 'field',
		symbol,
		length,
		raw,
		definition,
		presentation,
	};
};

const makeLiteralToken = (value: string, raw: string, quoted: boolean): LDMLLiteralToken => ({
	kind: 'literal',
	value,
	raw,
	quoted,
});

export class LDMLSyntaxError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LDMLSyntaxError';
	}
}

export function isFieldSymbol(value: string): value is FieldSymbol {
	return FIELD_SYMBOL_SET.has(value as FieldSymbol);
}

export function parseLDML<const Input extends string>(input: Input): ParseLDML<Input> {
	return internalParse(input) as ParseLDML<Input>;
}

export function internalParse(input: string): readonly LDMLToken[] {
	const tokens: LDMLToken[] = [];
	let index = 0;
	while (index < input.length) {
		const char = input[index]!;
		if (char === "'") {
			if (input[index + 1] === "'") {
				tokens.push(makeLiteralToken("'", "''", false));
				index += 2;
				continue;
			}
			let cursor = index + 1;
			let literal = '';
			let closed = false;
			while (cursor < input.length) {
				const next = input[cursor]!;
				if (next === "'") {
					const lookahead = input[cursor + 1];
					if (lookahead === "'") {
						literal += "'";
						cursor += 2;
						continue;
					}
					cursor += 1;
					closed = true;
					break;
				}
				literal += next;
				cursor += 1;
			}
			if (!closed) {
				throw new LDMLSyntaxError(`Unterminated quoted literal starting at index ${index}.`);
			}
			const raw = input.slice(index, cursor);
			tokens.push(makeLiteralToken(literal, raw, true));
			index = cursor;
			continue;
		}
		if (isFieldSymbol(char)) {
			let cursor = index + 1;
			while (cursor < input.length && input[cursor] === char) {
				cursor += 1;
			}
			const raw = input.slice(index, cursor);
			tokens.push(materializeFieldToken(raw));
			index = cursor;
			continue;
		}
		let cursor = index + 1;
		while (cursor < input.length) {
			const next = input[cursor]!;
			if (next === "'" || isFieldSymbol(next)) {
				break;
			}
			cursor += 1;
		}
		const literal = input.slice(index, cursor);
		tokens.push(makeLiteralToken(literal, literal, false));
		index = cursor;
	}
	return tokens;
}

export function stringifyLDML(tokens: readonly LDMLToken[]): string {
	return tokens.map(token => token.raw).join('');
}

export function compileLDML(tokens: readonly (LDMLToken | Omit<LDMLLiteralToken, 'raw'>)[]): string {
	return tokens
		.map(token => {
			if (token.kind === 'field') {
				validateLength(token.symbol, token.length);
				return token.raw;
			}
			const literalToken = token as LDMLLiteralToken;
			const { value, quoted } = literalToken;
			if (!quoted && !literalNeedsQuoting(value)) {
				return value.replace(/'/g, "''");
			}
			return `'${escapeLiteral(value)}'`;
		})
		.join('');
}

export function createFieldToken<const S extends FieldSymbol, const L extends AllowedLengths<S>>(
	symbol: S,
	length: L,
): LDMLFieldToken<S, L, RepeatChar<S, L>> {
	validateLength(symbol, length);
	const raw = symbol.repeat(length);
	return materializeFieldToken(raw) as LDMLFieldToken<S, L, RepeatChar<S, L>>;
}

export function createLiteralToken<const Value extends string>(
	value: Value,
	options?: { readonly forceQuote?: boolean },
): LDMLLiteralToken<Value> {
	const forceQuote = options?.forceQuote ?? false;
	const needsQuote = forceQuote || literalNeedsQuoting(value);
	if (!needsQuote) {
		return makeLiteralToken(value, value.replace(/'/g, "''"), false);
	}
	const escaped = escapeLiteral(value);
	return makeLiteralToken(value, `'${escaped}'`, true);
}

export function describeToken(token: LDMLToken): string {
	if (token.kind === 'literal') {
		return `literal(${JSON.stringify(token.value)})`;
	}
	const { symbol, length, presentation } = token;
	return `${symbol.repeat(length)} — ${presentation.summary}`;
}
