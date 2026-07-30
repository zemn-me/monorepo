import { bind_result, Err, Ok, unwrap } from '#root/ts/result/result.js';

export const doubled = bind_result((value: number) =>
	value >= 0 ? Ok(value * 2) : Err('negative')
);

export const result = doubled(Ok(21));
export const answer = unwrap(result); // 42
