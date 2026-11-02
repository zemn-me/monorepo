import { type Future, future, resolve } from '#root/ts/future/future.js';

export const answer: Future<number, number, Error> = resolve(42);
export const message = future(
	answer,
	value => `The answer is ${value}.`,
	progress => `Loading: ${progress}%`,
	error => `Failed: ${error.message}`
);
