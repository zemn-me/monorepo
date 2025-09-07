// the model wrote this and I don't understand it.

/**
 * Either<L, R>
 *
 * A tiny container that holds ONE of two things:
 *  - a Left value (often an error), or
 *  - a Right value (often a success).
 *
 * You use it by *supplying what to do* in each case.
 * Think: “If it’s Left do this; if it’s Right do that.”
 *
 * Quick example:
 *   const name = Right("Alice")
 *   const msg = either(name,
 *     err => `Oops: ${err}`,
 *     ok  => `Hello, ${ok}!`
 *   )
 *   // msg === "Hello, Alice!"
 */
/*#__NO_SIDE_EFFECTS__*/
export type Either<L, R> =
	<T>(onLeft: (l: L) => T, onRight: (r: R) => T) => T

/**
 * Make a Left value.
 * Use for errors or the “unhappy” path.
 *
 * Example: const notFound = Left("User not found")
 */
/*#__NO_SIDE_EFFECTS__*/
export const Left = <L, R = never>(l: L): Either<L, R> =>
	(onLeft, _onRight) => onLeft(l)

/**
 * Make a Right value.
 * Use for successes or the “happy” path.
 *
 * Example: const ok = Right(42)
 */
/*#__NO_SIDE_EFFECTS__*/
export const Right = <R, L = never>(r: R): Either<L, R> =>
	(_onLeft, onRight) => onRight(r)

export type Right<T, L = never> = Either<L, T>;
export type Left<T, R = never> = Either<T, R>;

/**
 * Run an Either by telling it what to do in each case.
 *
 * Example:
 *   const result = Right(10)
 *   const doubled = either(result,                // value to handle
 *     err => 0,                                   // if Left: give a fallback
 *     n   => n * 2                                // if Right: use the number
 *   ) // doubled === 20
 */
/*#__NO_SIDE_EFFECTS__*/
export const either = <L, R, T>(
	e: Either<L, R>,
	onLeft: (l: L) => T,
	onRight: (r: R) => T
): T => e(onLeft, onRight)

/** True if the value is Left (often: “is error?”). */
/*#__NO_SIDE_EFFECTS__*/
export const is_left = <L, R>(e: Either<L, R>) =>
	either(e, () => true, () => false)

/** True if the value is Right (often: “is success?”). */
/*#__NO_SIDE_EFFECTS__*/
export const is_right = <L, R>(e: Either<L, R>) =>
	!is_left(e)

/**
 * Transform the Right (success) value.
 *
 * Example:
 *   map(Right(3), n => n + 1)  // Right(4)
 *   map(Left("x"),  n => n + 1) // still Left("x")
 */
/*#__NO_SIDE_EFFECTS__*/
export const map = <L, R, RR>(e: Either<L, R>, f: (r: R) => RR): Either<L, RR> =>
	either(e, Left, r => Right(f(r)))

/**
 * Transform the Left (error) value.
 *
 * Example:
 *   map_left(Left("bad"), s => `ERR: ${s}`) // Left("ERR: bad")
 *   map_left(Right(7),    _ => 0)           // still Right(7)
 */
/*#__NO_SIDE_EFFECTS__*/
export const map_left = <L, LL, R>(e: Either<L, R>, f: (l: L) => LL): Either<LL, R> =>
	either(e, l => Left(f(l)), Right)

/**
 * Transform both sides at once.
 *
 * Example:
 *   bimap(Left(400),  n => `HTTP ${n}`, s => s)   // Left("HTTP 400")
 *   bimap(Right("x"), n => `HTTP ${n}`, s => s+s) // Right("xx")
 */
/*#__NO_SIDE_EFFECTS__*/
export const bimap = <L, LL, R, RR>(
	e: Either<L, R>,
	fl: (l: L) => LL,
	fr: (r: R) => RR
): Either<LL, RR> =>
	either(e, l => Left(fl(l)), r => Right(fr(r)))

/**
 * Chain operations that may fail.
 * If this is Left, it stays Left. If Right, run the next step.
 */
/*#__NO_SIDE_EFFECTS__*/
export const and_then = <L, R, RR>(
	e: Either<L, R>,
	f: (r: R) => Either<L, RR>
): Either<L, RR> =>
	either(e, Left, f)

/** Flatten nested Eithers: Right(Right(x)) → Right(x), Right(Left(e)) → Left(e). */
/*#__NO_SIDE_EFFECTS__*/
export const flatten = <L, R>(e: Either<L, Either<L, R>>): Either<L, R> =>
	and_then(e, x => x)

/**
 * Get the Left value or a default.
 *
 * NOTE: We tell TypeScript explicitly that both branches return `L | D`,
 * so it doesn’t try to force them to be the same single type.
 *
 * Example:
 *   from_left("none", Left("err"))  // "err"
 *   from_left("none", Right(5))     // "none"
 */
/*#__NO_SIDE_EFFECTS__*/
export const from_left = <L, R, D>(def: D, e: Either<L, R>): L | D =>
	either<L, R, L | D>(e, l => l, () => def)

/**
 * Get the Right value or a default.
 *
 * NOTE: Same trick—declare the union result up front to satisfy the generic.
 *
 * Example:
 *   from_right(0, Right(5))   // 5
 *   from_right(0, Left("x"))  // 0
 */
/*#__NO_SIDE_EFFECTS__*/
export const from_right = <L, R, D>(def: D, e: Either<L, R>): R | D =>
	either<L, R, R | D>(e, () => def, r => r)
