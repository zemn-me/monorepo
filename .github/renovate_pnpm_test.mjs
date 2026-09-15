import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { runfiles } from '@bazel/runfiles';
import { GlobalConfig } from 'renovate/dist/config/global.js';
import { extractPackageJson } from 'renovate/dist/modules/manager/npm/extract/common/package-file.js';
import { generateLockFile } from 'renovate/dist/modules/manager/npm/post-update/pnpm.js';

const require = createRequire(import.meta.url);
const repository = JSON.parse(
	readFileSync(runfiles.resolve(process.env.PACKAGE_JSON), 'utf8')
);
const expectedVersion = repository.packageManager.replace(/^pnpm@/, '');
assert.match(repository.packageManager, /^pnpm@\d+\.\d+\.\d+$/);
assert.equal(
	require('renovate/package.json').version,
	repository.devDependencies.renovate
);
for (const section of [
	'dependencies',
	'devDependencies',
	'optionalDependencies',
]) {
	assert.equal(
		repository[section]?.pnpm,
		undefined,
		'A pnpm dependency overrides Renovate packageManager selection'
	);
}

// The shared pin must remain discoverable by Renovate's npm manager, as must
// the Renovate dependency that controls the workflow's own version.
const extracted = extractPackageJson(repository, 'package.json');
for (const [depName, depType, currentValue] of [
	['pnpm', 'packageManager', expectedVersion],
	['renovate', 'devDependencies', repository.devDependencies.renovate],
]) {
	const dependency = extracted.deps.find(
		dep => dep.depName === depName && dep.depType === depType
	);
	assert.ok(dependency, `${depName} must remain managed by Renovate`);
	assert.equal(dependency.currentValue, currentValue);
	assert.equal(dependency.datasource, 'npm');
	assert.equal(dependency.skipReason, undefined);
}

const pnpm = runfiles.resolve(process.env.PNPM_BIN);
const fixture = path.join(process.env.TEST_TMPDIR, 'fixture');
const bin = path.join(process.env.TEST_TMPDIR, 'bin');
mkdirSync(fixture, { recursive: true });
mkdirSync(bin, { recursive: true });
// Disable pnpm's own version switching so a mismatched Bazel tool cannot hide.
process.env.npm_config_manage_package_manager_versions = 'false';
process.env.CI = 'true';
process.env.BAZEL_BINDIR = '.';
function runPnpm(args) {
	return spawnSync(pnpm, args, {
		cwd: fixture,
		env: process.env,
		encoding: 'utf8',
	});
}
function successfulPnpm(args) {
	const result = runPnpm(args);
	assert.equal(
		result.status,
		0,
		`${result.error ?? ''}\n${result.stdout}\n${result.stderr}`
	);
	return result.stdout.trim();
}
assert.equal(successfulPnpm(['--version']), expectedVersion);

for (const version of ['1.0.0', '2.0.0']) {
	const directory = path.join(fixture, version);
	mkdirSync(directory);
	writeFileSync(
		path.join(directory, 'package.json'),
		JSON.stringify({ name: 'fixture-dependency', version })
	);
}
const manifest = {
	name: 'renovate-pnpm-compatibility',
	private: true,
	packageManager: repository.packageManager,
	pnpm: repository.pnpm,
	dependencies: { 'fixture-dependency': 'file:1.0.0' },
};
const writeManifest = () =>
	writeFileSync(path.join(fixture, 'package.json'), JSON.stringify(manifest));
writeManifest();
successfulPnpm(['install', '--lockfile-only', '--ignore-scripts']);
manifest.dependencies['fixture-dependency'] = 'file:2.0.0';
writeManifest();
const stale = runPnpm([
	'install',
	'--offline',
	'--frozen-lockfile',
	'--ignore-scripts',
]);
assert.notEqual(stale.status, 0);
assert.match(stale.stdout + stale.stderr, /ERR_PNPM_OUTDATED_LOCKFILE/);

// Exercise Renovate's real containerbase version selection. Bazel already
// provides the tools: the installer verifies requests instead of downloading.
const installerLog = path.join(process.env.TEST_TMPDIR, 'installations');
process.env.EXPECTED_PNPM = expectedVersion;
process.env.EXPECTED_NODE = process.versions.node;
process.env.INSTALLER_LOG = installerLog;
process.env.PNPM_UNDER_TEST = pnpm;
process.env.PATH = `${bin}:${process.env.PATH}`;
process.env.CONTAINERBASE = 'true';
writeFileSync(
	path.join(bin, 'install-tool'),
	`#!/usr/bin/env bash
set -euo pipefail
printf '%s %s\\n' "$1" "$2" >> "$INSTALLER_LOG"
case "$1 $2" in
  "node $EXPECTED_NODE"|"pnpm $EXPECTED_PNPM") ;;
  *) echo "Unexpected tool selection: $*" >&2; exit 1 ;;
esac
`,
	{ mode: 0o755 }
);
writeFileSync(
	path.join(bin, 'pnpm'),
	'#!/usr/bin/env bash\nexec "$PNPM_UNDER_TEST" "$@"\n',
	{ mode: 0o755 }
);
GlobalConfig.set({
	localDir: fixture,
	cacheDir: path.join(process.env.TEST_TMPDIR, 'cache'),
	containerbaseDir: path.join(process.env.TEST_TMPDIR, 'containerbase'),
	binarySource: 'install',
	exposeAllEnv: true,
	executionTimeout: 1,
});
const result = await generateLockFile(
	'',
	{},
	{
		ignoreScripts: true,
		constraints: { node: process.versions.node },
	},
	[{ depName: 'fixture-dependency', newVersion: '2.0.0' }]
);
assert.ok(!result.error, JSON.stringify(result));
assert.deepEqual(readFileSync(installerLog, 'utf8').trim().split('\n'), [
	`node ${process.versions.node}`,
	`pnpm ${expectedVersion}`,
]);
assert.equal(
	result.lockFile,
	readFileSync(path.join(fixture, 'pnpm-lock.yaml'), 'utf8')
);
successfulPnpm([
	'install',
	'--offline',
	'--frozen-lockfile',
	'--ignore-scripts',
]);
assert.equal(
	JSON.parse(
		readFileSync(
			path.join(fixture, 'node_modules/fixture-dependency/package.json'),
			'utf8'
		)
	).version,
	'2.0.0'
);
