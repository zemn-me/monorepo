import { doSync } from '#root/ts/do-sync/index.js';

export const add = doSync(async (left: number, right: number) => left + right);
export const answer = add(20, 22); // 42
