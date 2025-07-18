import { z } from 'zod/v4-mini';

export const EqualTo = z.literal('=');
export type EqualTo = z.infer<typeof EqualTo>;

export const GreaterThan = z.literal('>');
export type GreaterThan = z.infer<typeof GreaterThan>;

export const LesserThan = z.literal('<');
export type LesserThan = z.infer<typeof LesserThan>;

export const GreaterThanOrEqualToUnicode = z.literal('≥');
export const GreaterThanOrEqualToAscii = z.literal('>=');
export const GreaterThanOrEqualTo = z.union([
	GreaterThanOrEqualToAscii,
	GreaterThanOrEqualToUnicode,
]);
export type GreaterThanOrEqualTo = z.infer<typeof GreaterThanOrEqualTo>;

export const LesserThanOrEqualToUnicode = z.literal('≤');
export const LesserThanOrEqualToAscii = z.literal('<=');
export const LesserThanOrEqualTo = z.union([
	LesserThanOrEqualToUnicode,
	LesserThanOrEqualToAscii,
]);
export type LesserThanOrEqualTo = z.infer<typeof LesserThanOrEqualTo>;
export const NotEqualToUnicode = z.literal('≠');
export const NotEqualToAscii = z.literal('!=');
export const NotEqualTo = z.union([NotEqualToUnicode, NotEqualToAscii]);
export type NotEqualTo = z.infer<typeof NotEqualTo>;

export const ComparatorString = z.union([
	EqualTo,
	GreaterThan,
	LesserThan,
	GreaterThanOrEqualTo,
	LesserThanOrEqualTo,
	NotEqualTo,
]);

export type ComparatorString = z.infer<typeof ComparatorString>;
