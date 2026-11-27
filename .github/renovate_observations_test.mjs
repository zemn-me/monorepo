import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from 'renovate/dist/config/defaults.js';
import { massageConfig } from 'renovate/dist/config/massage.js';
import { validateConfig } from 'renovate/dist/config/validation.js';
import { get as getVersioning } from 'renovate/dist/modules/versioning/index.js';
import { applyMinimumReleaseAgeToDigestUpdate } from 'renovate/dist/workers/repository/process/lookup/digest.js';
import { filterInternalChecks } from 'renovate/dist/workers/repository/process/lookup/filter-checks.js';
import { flattenUpdates } from 'renovate/dist/workers/repository/updates/flatten.js';
const { history, observationRules, observe } = await import(
	new URL('./renovate-observations.mjs', import.meta.url)
);

const base = JSON.parse(await readFile('.github/renovate-global.json', 'utf8'));
const now = Date.now();
const wait = 3 * 86_400_000 + 30 * 60_000;
const currentDigest = 'a'.repeat(40);
const digest = 'b'.repeat(40);
const other = 'c'.repeat(40);
const dep = {
	datasource: 'github-tags',
	depName: 'owner/action',
	packageName: 'owner/action',
	currentValue: 'v1.0.0',
	currentVersion: '1.0.0',
	currentDigest,
};
const pinned = { updateType: 'digest', newValue: 'v1.0.0', newDigest: digest };
const minor = {
	updateType: 'minor',
	newValue: 'v1.1.0',
	newVersion: '1.1.0',
	newDigest: digest,
};
const packageFile = '.github/workflows/test.yml';
const files = (updates, dependency = dep) => ({
	'github-actions': [
		{
			packageFile,
			deps: [{ ...dependency, updates: structuredClone(updates) }],
		},
	],
});

const report = files([pinned, minor]);
const first = observe(report, {}, now);
assert.equal(Object.keys(first).length, 2);
assert.deepEqual(observe(report, history(first), now + wait), first);
assert.deepEqual(
	observationRules(first, now + wait - 1, base),
	observationRules({}, now, base)
);
assert.deepEqual(observe({}, history(first), now + wait), {});
assert.deepEqual(
	observe(files([{ ...minor, newDigest: 'abcd' }]), history(first), now),
	{}
);
assert.deepEqual(
	observe(files([minor], { ...dep, currentDigest: undefined }), {}, now),
	{}
);
assert.deepEqual(
	observe(
		files([minor, { ...minor, newDigest: other }]),
		history(first),
		now
	),
	{}
);
const replaced = observe(
	files([{ ...minor, newDigest: other }]),
	history(first),
	now + wait
);
assert.equal(Object.values(replaced)[0].firstSeen, now + wait);
const returned = observe(files([minor]), history(replaced), now + wait + 1);
assert.equal(Object.values(returned)[0].firstSeen, now + wait + 1);
assert.deepEqual(
	observationRules(returned, now + wait + 1, base),
	observationRules({}, now, base)
);

const config = {
	...getConfig(),
	...base,
	semanticCommits: 'disabled',
	internalChecksFilter: 'strict',
	packageRules: observationRules(first, now + wait, base),
};
const lookup = { ...config, manager: 'github-actions', packageFile, ...dep };
for (const [pin, pending] of [
	[digest, false],
	[other, true],
]) {
	const update = { ...pinned, newDigest: pin };
	await applyMinimumReleaseAgeToDigestUpdate(
		update,
		lookup,
		{ updates: [update] },
		true,
		undefined
	);
	assert.equal(Boolean(update.pendingChecks), pending);
}
const version = getVersioning('semver');
const select = (release, context = lookup) =>
	filterInternalChecks(context, version, 'minor', [release]);
assert.equal(
	(await select({ version: minor.newVersion })).pendingChecks,
	false
);
assert.equal((await select({ version: '1.2.0' })).pendingChecks, true);
assert.equal(
	(
		await select({
			version: minor.newVersion,
			releaseTimestamp: new Date(now).toISOString(),
		})
	).pendingChecks,
	true
);
assert.equal(
	(
		await select(
			{ version: minor.newVersion },
			{ ...lookup, minimumReleaseAge: '7 days' }
		)
	).pendingChecks,
	true
);

for (const candidate of [pinned, minor]) {
	for (const [pin, expectedCount] of [
		[digest, 1],
		[other, 0],
		[undefined, 0],
	]) {
		const resolved = await flattenUpdates(
			config,
			files([{ ...candidate, newDigest: pin }])
		);
		assert.equal(
			resolved.length,
			expectedCount,
			`${candidate.updateType} ${pin}`
		);
		if (resolved.length)
			assert.equal(
				resolved[0].minimumReleaseAgeBehaviour,
				'timestamp-optional'
			);
	}
}

// Run the workflow's two phases against a report that changes during the live lookup.
const dir = await mkdtemp(
	join(process.env.TEST_TMPDIR ?? tmpdir(), 'renovate-age-')
);
const reportPath = join(dir, 'lookup.json');
const statePath = join(dir, 'observations.json');
const configPath = join(dir, 'renovate.json');
const script = fileURLToPath(
	new URL('./renovate-observations.mjs', import.meta.url)
);
const run = configFile =>
	execFileSync(
		process.execPath,
		[script, reportPath, statePath, ...configFile],
		{
			env: { ...process.env, GITHUB_REPOSITORY: 'org/repo' },
		}
	);
const writeReport = updates =>
	writeFile(
		reportPath,
		JSON.stringify({
			repositories: { 'org/repo': { packageFiles: files(updates) } },
		})
	);
await writeReport([pinned, minor]);
run([configPath]);
const stored = JSON.parse(await readFile(statePath, 'utf8'));
assert(Object.keys(stored).every(key => /^[0-9a-f]{64}$/.test(key)));
for (const entry of Object.values(stored)) entry.firstSeen = now - wait;
await writeFile(statePath, JSON.stringify(stored));
run([configPath]);
const aged = JSON.parse(await readFile(configPath, 'utf8'));
assert(aged.packageRules.length > base.packageRules.length);
assert.deepEqual((await validateConfig('global', massageConfig(aged))).errors, []);
await writeReport([{ ...pinned, newDigest: other }, minor]);
run([]);
assert.deepEqual(Object.values(JSON.parse(await readFile(statePath, 'utf8'))), [
	{ digest, firstSeen: now - wait },
]);

const initialPin = { ...pinned, updateType: 'pinDigest', isPinDigest: true };
const unpinned = { ...dep, currentDigest: undefined };
const initial = observe(files([initialPin], unpinned), {}, now);
for (const [age, pin, count] of [
	[0, digest, 0],
	[wait, digest, 1],
	[wait, other, 0],
]) {
	const rules = observationRules(initial, now + age, base);
	const candidates = files([{ ...initialPin, newDigest: pin }], unpinned);
	assert.equal(
		(await flattenUpdates({ ...config, packageRules: rules }, candidates))
			.length,
		count
	);
}
