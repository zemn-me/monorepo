import { Future, unpack } from "#root/ts/result/react-query/future.js";

export function debug<T, E>(
	caption: string,
	f: Future<T, E>,
) {
	return unpack(
		f,
		// eslint-disable-next-line no-console
		s => console.log(caption, 'success', s),
		// eslint-disable-next-line no-console
		s => console.log(caption, 'failure', s),
		// eslint-disable-next-line no-console
		() => console.log(caption, 'pending...'),
	)
}
