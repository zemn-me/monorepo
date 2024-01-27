import { Result } from '#root/ts/result.js';

export { Err, Ok } from '#root/ts/result.js';

export type Option<O> = Result<O, undefined>;
