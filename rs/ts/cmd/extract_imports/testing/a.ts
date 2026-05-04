import 'node:assert';
export * as dict from '#root/ts/iter/dict.js';
export * from "#root/ts/math/camera.js";
import { promisify } from 'node:util';

// biome-ignore lint/suspicious/noConsole: this intentionally writes to the console
console.log(promisify);
