export const EqualTo = '=';
export type EqualTo = typeof EqualTo;
export const GreaterThan = '>';
export type GreaterThan = typeof GreaterThan;
export const LesserThan = '<';
export type LesserThan = typeof LesserThan;
export const GreaterThanOrEqualToUnicode = '≥';
export const GreaterThanOrEqualToAscii = '>=';
export type GreaterThanOrEqualTo =
	| typeof GreaterThanOrEqualToUnicode
	| typeof GreaterThanOrEqualToAscii;
export const LesserThanOrEqualToUnicode = '≤';
export const LesserThanOrEqualToAscii = '<=';
export type LesserThanOrEqualTo =
	| typeof LesserThanOrEqualToUnicode
	| typeof LesserThanOrEqualToAscii;
export const NotEqualToUnicode = '≠';
export const NotEqualToAscii = '!=';
export type NotEqualTo = typeof NotEqualToUnicode | typeof NotEqualToAscii;

export type ComparatorString =
	| EqualTo
	| GreaterThan
	| LesserThan
	| GreaterThanOrEqualTo
	| LesserThanOrEqualTo
	| NotEqualTo;
