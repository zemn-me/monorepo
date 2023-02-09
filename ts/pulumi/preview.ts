/**
 * @fileoverview
 * Runs the pulumi config in preview mode.
 */

import { run } from 'ts/pulumi/run';

run(true, true).catch(e => {
	console.error(e);
	process.exitCode = 1;
});
