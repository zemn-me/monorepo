import { _ResultSequence, Err, Ok as Some, Result } from '#root/ts/result.js';

export { Some };

export const None = { [Err]: undefined };
export type None = typeof None;

export type Option<O> = Result<O, undefined>;

export class _OptionSequence<O> extends _ResultSequence<O, undefined> {
	orError<E>(e: () => E): _ResultSequence<O, E> {
		const res = this.result;
		if (Some in res) return new _ResultSequence(res);
		return new _ResultSequence({ [Err]: e() });
	}
}

export const OptionSequence = <O>(v: Option<O>) => new _OptionSequence(v);
