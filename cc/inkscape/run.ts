/**
 * @fileoverview Extra special wrapper of inkscape
 * for typescript projects because rules_js is a special
 * child and has its own ideas about how runfiles should work.
 */

import child_process from 'node:child_process';

child_process.execFileSync(
	'cc/inkscape/app_image_local/external/inkscape_linux/file/bin',
	['--appimage-extract-and-run', ...process.argv.slice(2)],
	{
		stdio: 'pipe',
	}
);
