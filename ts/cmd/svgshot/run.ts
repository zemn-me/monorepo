#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * @fileoverview The main entry point for svgshot.
 *
 * Svgshot is separated out into a lib to allow easier testing.
 *
 * I wouldn't worry about it too much.
 */

import main from '#root/ts/cmd/svgshot/lib.js';

main()
	.then(() => process.exit(0))
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
