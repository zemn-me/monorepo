/**
 * SimpleDate: a simple, unambiguous,
 *  type checked date syntax for typescript.
 */

import { z } from 'zod';

export const Month = z.enum([
	"jan",
	"feb",
	"mar",
	"apr",
	"may",
	"jun",
	"jul",
	"aug",
	"sep",
	"oct",
	"nov",
	"dec",
]).describe("Month name (short).");

export const Year = z.number().describe("Numeric year.");

export const OneTo29 = z.union([
	z.literal(1),
z.literal(2),
z.literal(3),
z.literal(4),
z.literal(5),
z.literal(6),
z.literal(7),
z.literal(8),
z.literal(9),
z.literal(10),
z.literal(11),
z.literal(12),
z.literal(13),
z.literal(14),
	z.literal(15),
z.literal(16),
z.literal(17),
z.literal(18),
z.literal(19),
z.literal(20),
z.literal(21),
z.literal(22),
z.literal(23),
z.literal(24),
	z.literal(25),
z.literal(26),
z.literal(27),
z.literal(28),
z.literal(29),
]);

const OneTo30 = z.union([
	OneTo29,
	z.literal(30)
])

const OneTo31 = z.union([
	OneTo30,
	z.literal(31)
]);

export const Date = z.union([
	z.tuple([
		OneTo31,
		z.literal(Month.enum.jan),
		Year,
	]),
	z.tuple([
		OneTo29,
		z.literal(Month.enum.feb),
		Year,
	]),
	z.tuple([
		OneTo31,
		z.literal(Month.enum.mar),
		Year
	]),
	z.tuple([
		OneTo30,
		z.literal(Month.enum.apr),
		Year
	]),
	z.tuple([
		OneTo31,
		z.literal(Month.enum.may),
		Year
	]),
	z.tuple([
		OneTo30,
		z.literal(Month.enum.jun),
		Year,
	]),
	z.tuple([
		OneTo31,
		z.literal(Month.enum.jul),
		Year
	]),
	z.tuple([
		OneTo31,
		z.literal(Month.enum.aug),
		Year,
	]),
	z.tuple([
		OneTo30,
		z.literal(Month.enum.sep),
		Year,
	]),
	z.tuple([
		OneTo31,
		z.literal(Month.enum.oct),
		Year
	]),
	z.tuple([
		OneTo30,
		z.literal(Month.enum.nov),
		Year
	]),
	z.tuple([
		OneTo31,
		z.literal(Month.enum.dec),
		Year
	])
]);

export const date = Date;

const numericMonthAssociations = {
		[Month.enum.jan]: 0,
		[Month.enum.feb]: 1,
		[Month.enum.mar]: 2,
		[Month.enum.apr]: 3,
		[Month.enum.may]: 4,
		[Month.enum.jun]: 5,
		[Month.enum.jul]: 6,
		[Month.enum.aug]: 7,
		[Month.enum.sep]: 8,
		[Month.enum.oct]: 9,
		[Month.enum.nov]: 10,
		[Month.enum.dec]: 11,
}

export type Date = z.TypeOf<typeof Date>;
export type date = Date;
export type SimpleDate = Date;

export function parse([y, m, d]: Date): globalThis.Date {
	return new globalThis.Date(y, numericMonthAssociations[m], d);
}

export const nativeDateFromUnknownSimpleDate = Date.transform(parse);




