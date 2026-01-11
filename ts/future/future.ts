
/**
 * A value which hasn't arrived yet.
 */
export type Future<Then, Loading, Error> =
	<T>(
		/**
		 * Executed when the {@link Future} succeeds.
		 */
		then: (value: Then) => T,
		/**
		 * Executed when the {@link Future} is loading.
		 */
		loading: (value: Loading) => T,
		/**
		 * Executed when the {@link Future} errors.
		 */
		error: (value: Error) => T,
	) => T

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
	<Then, Loading = never, Error = never>(error_value: Error): Future<Then, Loading, Error> =>
		(_then, _loading, error) => error(error_value);

/**
 * A {@link Future} that is always loading.
 */
export const loading =
	<Then, Loading = never, Error = never>(loading_value: Loading): Future<Then, Loading, Error> =>
		(_then, loading, _error) => loading(loading_value)

/**
 * Execute a {@link Future} with a set of handlers.
 *
 * This is identical to calling the future directly, but
 * may read better.
 */
export const future =
	<Then, Loading, Error, T>(
		f: Future<Then, Loading, Error>,
		then: (value: Then) => T,
		onLoading: (value: Loading) => T,
		onError: (value: Error) => T,
	): T => f(then, onLoading, onError);

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
