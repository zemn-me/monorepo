import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GlobalConfig } from 'renovate/dist/config/global.js';
import { extractPythonVersion } from 'renovate/dist/modules/manager/pip-compile/common.js';
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
	'py/mitmproxy/requirements.txt',
]);
assert.equal(files?.length, 2);
files.sort((a, b) => a.packageFile === 'requirements.in' ? -1 : 1);
assert.equal(files[0].packageFile, 'requirements.in');
assert.deepEqual(files[0].lockFiles, ['requirements.txt']);
const direct = files[0].deps.find(dep => dep.packageName === 'pydantic');
const indirect = files[0].deps.find(dep => dep.packageName === 'pydantic-core');
assert(direct?.lockedVersion);
assert.notEqual(direct.depType, 'indirect');
assert.equal(indirect?.depType, 'indirect');

// A successful solve may otherwise replace a supported tool with an ancient
// release whose metadata permits the newest transitive dependencies.
for (const dep of files.flatMap(file => file.deps).filter(dep => dep.depType !== 'indirect')) {
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
assert.equal(files[0].deps.some(dep => dep.packageName === 'mitmproxy'), false);
assert.equal(files[1].packageFile, 'py/mitmproxy/requirements.in');
assert.deepEqual(files[1].lockFiles, ['py/mitmproxy/requirements.txt']);
const isolatedLock = 'py/mitmproxy/requirements.txt';
assert.equal(
	extractPythonVersion(await readFile(isolatedLock, 'utf8'), isolatedLock),
	'3.14'
);
const mitmproxy = files[1].deps.find(dep => dep.packageName === 'mitmproxy');
assert(mitmproxy?.lockedVersion);
assert.notEqual(mitmproxy.depType, 'indirect');
assert.equal(pep440.matches('0.14.0', mitmproxy.currentValue), false);
