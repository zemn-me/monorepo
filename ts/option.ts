import { Result } from '#root/ts/result.js';

export { Err as None, Ok as Some } from '#root/ts/result.js';

export type Option<O> = Result<O, undefined>;
