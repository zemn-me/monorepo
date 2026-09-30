import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GlobalConfig } from 'renovate/dist/config/global.js';
import { extractAllPackageFiles } from 'renovate/dist/modules/manager/pip-compile/extract.js';

// Exercise Renovate's own extractor against the checked-in lock and source.
// Valid JSON alone did not catch a disabled manager or an unreadable header.
const config = JSON.parse(
	await readFile('.github/renovate-global.json', 'utf8')
);
assert.equal(config.pip_requirements.enabled, false);
assert(
	config['pip-compile'].managerFilePatterns.includes('/^requirements\\.txt$/')
);
GlobalConfig.set({ localDir: process.cwd() });
const files = await extractAllPackageFiles(config['pip-compile'], [
	'requirements.txt',
]);
assert.equal(files?.length, 1);
assert.equal(files[0].packageFile, 'requirements.in');
assert.deepEqual(files[0].lockFiles, ['requirements.txt']);
const direct = files[0].deps.find(dep => dep.packageName === 'pydantic');
const indirect = files[0].deps.find(dep => dep.packageName === 'pydantic-core');
assert(direct?.lockedVersion);
assert.notEqual(direct.depType, 'indirect');
assert.equal(indirect?.depType, 'indirect');
