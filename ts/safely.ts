import { Err, Ok, Result } from '#root/ts/result.js';

export class SafelyError extends Error {
	constructor(cause: unknown) {
		const causalError = cause instanceof Error ? cause : undefined;

		super(
			causalError ? 'An error occurred.' : `An error occurred: ${cause}.`
		);
		if (causalError) this.cause = causalError;
	}
}

export const safely =
	<I extends unknown[], O>(f: (...args: I) => O) =>
	(...args: I): Result<O, SafelyError> => {
		try {
			return { [Ok]: f(...args) };
		} catch (e) {
			return { [Err]: new SafelyError(e) };
		}
	};
