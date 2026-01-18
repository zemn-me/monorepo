
/**
 * A value which hasn't arrived yet.
 */
export type Future<Then, Loading, Error> =
	<T1, T2, T3>(
		/**
		 * Executed when the {@link Future} succeeds.
		 */
		then: (value: Then) => T1,
		/**
		 * Executed when the {@link Future} is loading.
		 */
		loading: (value: Loading) => T2,
		/**
		 * Executed when the {@link Future} errors.
		 */
		error: (value: Error) => T3,
	) => T1 | T2 | T3

/**
 * A {@link Future} that is never loading
 * and never errors.
 */
export const resolve =
	<Then, Loading = never, Error = never>(then_value: Then): Future<Then, Loading, Error> =>
	(then, _loading, _error) => then(then_value)

/**
 * A {@link Future} that always errors.
 */
export const error =
	<Error, Loading = never, Then=never>(error_value: Error): Future<Then, Loading, Error> =>
		(_then, _loading, error) => error(error_value);

/**
 * A {@link Future} that is always loading.
 */
export const loading =
	<Loading, Then=never, Error = never>(loading_value: Loading): Future<Then, Loading, Error> =>
		(_then, loading, _error) => loading(loading_value)

/**
 * Execute a {@link Future} with a set of handlers.
 *
 * This is identical to calling the future directly, but
 * may read better.
 */
export const future =
	<Then, Loading, Error, T1, T2, T3>(
		f: Future<Then, Loading, Error>,
		then: (value: Then) => T1,
		onLoading: (value: Loading) => T2,
		onError: (value: Error) => T3,
	): T1 | T2 | T3 => f(then, onLoading, onError);


/**
 * Modify the contained value of an {@link Future} on success.
 */
export const future_and_then =
	<Then, Loading, Error, NewThen> (
		future: Future<Then, Loading, Error>,
		f_then: (value: Then) => NewThen
	): Future<NewThen, Loading, Error> => future(
		actual => resolve(f_then(actual)),
		l => loading(l),
		e => error(e)
	)

export const future_flatten_then =
	<
		Then, Loading1, Error1,
		Loading2, Error2,
	>(
		a: Future<
			Future<Then, Loading1, Error1>,
			Loading2,
			Error2
		>
	): Future<Then, Loading1 | Loading2, Error1 | Error2> => a(
		then1 => then1(
			then => resolve(then),
			loading2 => loading(loading2),
			error2 => error(error2),
		),
		loading1 => loading(loading1),
		error1 => error(error1)
	)



export const coincide_then =
	<
		Then1, Loading1, Error1,
		Then2, Loading2, Error2,
		NewThen,
	>(
		future1: Future<Then1, Loading1, Error1>,
		future2: Future<Then2, Loading2, Error2>,
		then: (a: Then1, b: Then2) => NewThen,
	): Future<NewThen, Loading1 | Loading2, Error1 | Error2> => future1(
			then1 => future2(
				then2 => resolve(then(then1, then2)),
				loading2 => loading(loading2),
				error2 => error(error2)
			),
			loading1 => future2(
				() => loading(loading1),
				() => loading(loading1),
				error2 => error(error2)
			),
			error1 => future2(
				() => error(error1),
				() => error(error1),
				() => error(error1),
			)
		)
