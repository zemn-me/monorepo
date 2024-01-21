/**
 * @fileoverview
 * Runs the pulumi config in preview mode.
 */

import * as stack from '#root/ts/pulumi/stack.js';

(async function main() {
	await (await stack.production()).preview();
})().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
