/**
 * @fileoverview
 * Runs the pulumi config in preview mode.
 */

import { stack } from 'ts/pulumi/run';

(async function main() {
	(await stack()).preview();
})().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
