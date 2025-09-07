// ts/either/either.test.ts
import { describe, expect, jest, test } from '@jest/globals';

import {
	and_then,
	bimap,
	Either,
	either,
	flatten,
	from_left,
	from_right,
	is_left,
	is_right,
	Left,
	map,
	map_left,
	Right,
} from "#root/ts/either/either";

describe("Either (Church-encoded)", () => {
	describe("constructors & basic branching", () => {
		test("Right calls right handler", () => {
			const e = Right(42)
			const onLeft = jest.fn(() => "L")
			const onRight = jest.fn((n: number) => `R:${n}`)
			const out = either(e, onLeft, onRight)
			expect(out).toBe("R:42")
			expect(onLeft).not.toHaveBeenCalled()
			expect(onRight).toHaveBeenCalledTimes(1)
		})

		test("Left calls left handler", () => {
			const e = Left("err")
			const onLeft = jest.fn((s: string) => `L:${s}`)
			const onRight = jest.fn(() => "R")
			const out = either(e, onLeft, onRight)
			expect(out).toBe("L:err")
			expect(onLeft).toHaveBeenCalledTimes(1)
			expect(onRight).not.toHaveBeenCalled()
		})
	})

	describe("predicates", () => {
		test("is_right / is_left behave", () => {
			const r = Right(7)
			const l = Left("x")
			expect(is_right(r)).toBe(true)
			expect(is_left(r)).toBe(false)
			expect(is_right(l)).toBe(false)
			expect(is_left(l)).toBe(true)
		})
	})

	describe("map / map_left / bimap", () => {
		test("map transforms Right, leaves Left", () => {
			const r = Right(3)
			const l = Left("oops")
			const r2 = map(r, n => n + 1)
			const l2 = map(l, n => n + 1)

			expect(either(r2, _ => "L", n => `R:${n}`)).toBe("R:4")
			expect(either(l2, s => `L:${s}`, _ => "R")).toBe("L:oops")
		})

		test("map_left transforms Left, leaves Right", () => {
			const r = Right<number, string>(3)
			const l = Left<string, number>("oops")
			const r2 = map_left(r, s => `E:${s}`)
			const l2 = map_left(l, s => `E:${s}`)

			expect(either(r2, s => `L:${s}`, n => `R:${n}`)).toBe("R:3")
			expect(either(l2, s => `L:${s}`, _ => "R")).toBe("L:E:oops")
		})

		test("bimap transforms both sides as expected", () => {
			const r = Right<number, string>(10)
			const l = Left<string, number>("bad")
			const r2 = bimap(r, s => `E:${s}`, n => n * 2)
			const l2 = bimap(l, s => `E:${s}`, n => n * 2)

			expect(either(r2, s => `L:${s}`, n => `R:${n}`)).toBe("R:20")
			expect(either(l2, s => `L:${s}`, _ => "R")).toBe("L:E:bad")
		})

		test("law: bimap(fl, fr) == map_left(fl) then map(fr) (on values)", () => {
			const fl = (s: string) => s + "!"
			const fr = (n: number) => n + 1

			const values: Array<Either<string, number>> = [
				Left<string, number>("x"),
				Right<number, string>(41),
			]

			for (const e of values) {
				const viaBimap = bimap(e, fl, fr)
				const viaCompose = map(map_left(e, fl), fr)

				const out1 = either(viaBimap, s => `L:${s}`, n => `R:${n}`)
				const out2 = either(viaCompose, s => `L:${s}`, n => `R:${n}`)
				expect(out1).toBe(out2)
			}
		})
	})

	describe("and_then / flatten", () => {
		const parseIntE = (s: string): Either<string, number> =>
			isNaN(+s) ? Left(`NaN:${s}`) : Right(+s)

		const doubleE = (n: number): Either<string, number> =>
			n % 2 === 0 ? Right(n * 2) : Left("odd")

		test("and_then: propagates Left, chains Right", () => {
			const ok = Right("12")
			const bad = Right("nope")
			const left = Left("boom")

			const r1 = and_then(and_then(ok, parseIntE), doubleE)
			const r2 = and_then(and_then(bad, parseIntE), doubleE)
			const r3 = and_then(and_then(left, parseIntE), doubleE)

			expect(either(r1, s => `L:${s}`, n => `R:${n}`)).toBe("R:24")
			expect(either(r2, s => `L:${s}`, n => `R:${n}`)).toBe("L:NaN:nope")
			expect(either(r3, s => `L:${s}`, n => `R:${n}`)).toBe("L:boom")
		})

		test("flatten collapses nesting", () => {
			const rr: Either<string, Either<string, number>> = Right(Right(5))
			const rl: Either<string, Either<string, number>> = Right(Left("e"))
			const l: Either<string, Either<string, number>> = Left("x")

			expect(either(flatten(rr), s => `L:${s}`, n => `R:${n}`)).toBe("R:5")
			expect(either(flatten(rl), s => `L:${s}`, n => `R:${n}`)).toBe("L:e")
			expect(either(flatten(l), s => `L:${s}`, n => `R:${n}`)).toBe("L:x")
		})
	})

	describe("from_left / from_right", () => {
		test("from_right: gets value or default", () => {
			expect(from_right(0, Right<number, string>(7))).toBe(7)
			expect(from_right(0, Left<string, number>("e"))).toBe(0)
		})

		test("from_left: gets error or default", () => {
			expect(from_left("none", Left<string, number>("bad"))).toBe("bad")
			expect(from_left("none", Right<number, string>(9))).toBe("none")
		})
	})

	describe("handler exclusivity", () => {
		test("only the matching handler is invoked", () => {
			const l = Left<string, number>("stop")
			const r = Right<number, string>(99)
			const onLeft = jest.fn(() => "L")
			const onRight = jest.fn(() => "R")

			either(l, onLeft, onRight)
			expect(onLeft).toHaveBeenCalledTimes(1)
			expect(onRight).not.toHaveBeenCalled()

			onLeft.mockClear()
			onRight.mockClear()

			either(r, onLeft, onRight)
			expect(onRight).toHaveBeenCalledTimes(1)
			expect(onLeft).not.toHaveBeenCalled()
		})
	})
})
