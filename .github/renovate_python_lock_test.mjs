import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GlobalConfig } from 'renovate/dist/config/global.js';
import { extractAllPackageFiles } from 'renovate/dist/modules/manager/pip-compile/extract.js';
import { api as pep440 } from 'renovate/dist/modules/versioning/pep440/index.js';

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

// A successful solve may otherwise replace a supported tool with an ancient
// release whose metadata permits the newest transitive dependencies.
for (const dep of files[0].deps.filter(dep => dep.depType !== 'indirect')) {
	assert.match(
		dep.currentValue,
		/^>=\d/,
		`${dep.packageName} needs a supported version floor`
	);
	assert(
		pep440.matches(dep.lockedVersion, dep.currentValue),
		`${dep.packageName} lock violates its supported range`
	);
}
const mitmproxy = files[0].deps.find(dep => dep.packageName === 'mitmproxy');
assert.equal(pep440.matches('0.14.0', mitmproxy.currentValue), false);
