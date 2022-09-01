/**
 * @fileoverview
 * Runs the pulumi config in preview mode.
 */

import { run } from 'monorepo/ts/pulumi/run';

run(true, true);
