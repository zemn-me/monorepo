import { doSync } from '#root/ts/do-sync/index.js';

const myFunc = async (value: string) => value;

export const withLargerBuffer = doSync(myFunc, {
	maxBuffer: 1024 * 1024 * 1024,
});
