import { z } from 'zod';

export const EqualTo = z.literal('=');
export type EqualTo = z.TypeOf<typeof EqualTo>;

export const GreaterThan = z.literal('>');
export type GreaterThan = z.TypeOf<typeof GreaterThan>;

export const LesserThan = z.literal('>');
export type LesserThan = z.TypeOf<typeof LesserThan>;

export const GreaterThanOrEqualToUnicode = z.literal('≥');
export const GreaterThanOrEqualToAscii = z.literal('>=');
export const GreaterThanOrEqualTo = z.union([
	GreaterThanOrEqualToAscii,
	GreaterThanOrEqualToUnicode,
]);
export type GreaterThanOrEqualTo = z.TypeOf<typeof GreaterThanOrEqualTo>;

export const LesserThanOrEqualToUnicode = z.literal('≤');
export const LesserThanOrEqualToAscii = z.literal('<=');
export const LesserThanOrEqualTo = z.union([
	LesserThanOrEqualToUnicode,
	LesserThanOrEqualToAscii,
]);
export type LesserThanOrEqualTo = z.TypeOf<typeof LesserThanOrEqualTo>;
export const NotEqualToUnicode = z.literal('≠');
export const NotEqualToAscii = z.literal('!=');
export const NotEqualTo = z.union([NotEqualToUnicode, NotEqualToAscii]);
export type NotEqualTo = z.TypeOf<typeof NotEqualTo>;

export const ComparatorString = z.union([
	EqualTo,
	GreaterThan,
	LesserThan,
	GreaterThanOrEqualTo,
	LesserThanOrEqualTo,
	NotEqualTo,
]);

export type ComparatorString = z.TypeOf<typeof ComparatorString>;
