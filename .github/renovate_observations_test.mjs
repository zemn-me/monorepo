import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from 'renovate/dist/config/defaults.js';
import { mergeChildConfig } from 'renovate/dist/config/index.js';
import { resolveConfigPresets } from 'renovate/dist/config/presets/index.js';
import { applyPackageRules } from 'renovate/dist/util/package-rules/index.js';
import { massageConfig } from 'renovate/dist/config/massage.js';
import { validateConfig } from 'renovate/dist/config/validation.js';
import { get as getVersioning } from 'renovate/dist/modules/versioning/index.js';
import { applyMinimumReleaseAgeToDigestUpdate } from 'renovate/dist/workers/repository/process/lookup/digest.js';
import { filterInternalChecks } from 'renovate/dist/workers/repository/process/lookup/filter-checks.js';
import { getRollbackUpdate } from 'renovate/dist/workers/repository/process/lookup/rollback.js';
import { addReplacementUpdateIfValid } from 'renovate/dist/workers/repository/process/lookup/utils.js';
import { flattenUpdates } from 'renovate/dist/workers/repository/updates/flatten.js';
const { history, lookupNpmDates, observationRules, observe } = await import(
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
assert.deepEqual(
	(await validateConfig('global', massageConfig(aged))).errors,
	[]
);
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

// Renovate stores dates for versioned initial pins on the dependency. The
// native lookup checks the newest matching version separately, including ranges.
for (const [days, pending] of [
	[7, false],
	[1, true],
]) {
	const published = new Date(now - days * 86_400_000).toISOString();
	const versioned = { ...unpinned, currentVersionTimestamp: published };
	const update = { ...initialPin };
	const strict = { ...config, packageRules: observationRules({}, now, base) };
	await applyMinimumReleaseAgeToDigestUpdate(
		update,
		{ ...lookup, ...versioned, packageRules: strict.packageRules },
		{ updates: [] },
		true,
		published
	);
	assert.equal(Boolean(update.pendingChecks), pending);
	const [branch] = await flattenUpdates(strict, files([update], versioned));
	assert.ok(branch);
	assert.equal(Boolean(branch.pendingChecks), pending);
}

const rollback = {
	updateType: 'rollback',
	newVersion: '0.9.0',
	newValue: 'v0.9.0',
};
const oldDate = new Date(now - wait - 1000).toISOString();
assert.equal(
	(
		await flattenUpdates(
			{ ...config, packageRules: observationRules({}, now, base) },
			files([rollback], unpinned)
		)
	).length,
	0
);
const rollbackFiles = files([{ ...rollback, newDigest: digest }]);
const rollbackObs = observe(rollbackFiles, {}, now);
const rollbackRules = observationRules(
	rollbackObs,
	now + wait,
	base,
	rollbackFiles
);
for (const [pin, count] of [
	[digest, 1],
	[other, 0],
]) {
	const branches = await flattenUpdates(
		{ ...config, packageRules: rollbackRules },
		files([{ ...rollback, newDigest: pin }])
	);
	assert.equal(branches.length, count);
	if (count)
		assert.equal(
			branches[0].minimumReleaseAgeBehaviour,
			'timestamp-optional'
		);
}

// Resolve the same presets as the bot. best-practices ordinarily switches off
// minimumReleaseAge for npm range pins, even with a repository-wide floor.
const { config: withPresets, visitedPresets } = await resolveConfigPresets(
	massageConfig(structuredClone(base))
);
assert(visitedPresets.merged.includes('security:minimumReleaseAgeNpm'));
const effective = mergeChildConfig(getConfig(), withPresets);
assert.equal(
	effective.vulnerabilityAlerts.minimumReleaseAge,
	base.minimumReleaseAge
);
const vulnerable = await applyPackageRules({
	...effective,
	datasource: 'npm',
	depName: 'example',
	packageName: 'example',
	currentVersion: '1.0.0',
	updateType: 'minor',
	packageRules: [
		...effective.packageRules,
		{
			matchPackageNames: ['example'],
			isVulnerabilityAlert: true,
			force: effective.vulnerabilityAlerts,
		},
	],
});
assert.equal(vulnerable.minimumReleaseAge, base.minimumReleaseAge);
assert.equal(
	(
		await select(
			{ version: '1.1.0', releaseTimestamp: new Date(now).toISOString() },
			vulnerable
		)
	).pendingChecks,
	true
);

const npm = {
	datasource: 'npm',
	depName: 'example',
	packageName: 'example',
	currentValue: '^1.0.0',
	currentVersion: '1.1.0',
	currentVersionTimestamp: oldDate,
};
const npmFiles = {
	npm: [
		{
			packageFile: 'package.json',
			deps: [
				{
					...npm,
					updates: [
						{
							updateType: 'pin',
							newVersion: '1.1.0',
							newValue: '1.1.0',
							isPin: true,
						},
					],
				},
			],
		},
	],
};
const resolvedConfig = {
	...effective,
	semanticCommits: 'disabled',
	packageRules: [
		...effective.packageRules,
		...observationRules({}, now, base, npmFiles),
	],
};
const [npmPin] = await flattenUpdates(resolvedConfig, npmFiles);
assert.ok(npmPin);
assert.equal(npmPin.minimumReleaseAge, base.minimumReleaseAge);
assert.equal(npmPin.minimumReleaseAgeBehaviour, 'timestamp-optional');

// Exercise the update shapes emitted by Renovate, including omission of the
// target time. Bind the second lookup to the exact registry, name and version.
const registry = 'https://registry.npmjs.org';
const original = {
	...npm,
	registryUrl: registry,
	currentValue: '2.0.0',
	currentVersion: '2.0.0',
};
const workerConfig = {
	...original,
	versioning: 'npm',
	manager: 'npm',
	rangeStrategy: 'pin',
	packageFile: 'package.json',
};
const npmReport = (date, registryUrl = registry) => {
	const updates = [
		getRollbackUpdate(
			workerConfig,
			[{ version: '1.0.0', releaseTimestamp: date }],
			getVersioning('npm')
		),
	];
	addReplacementUpdateIfValid(updates, {
		...workerConfig,
		replacementName: 'next-example',
		replacementVersion: '1.0.0',
	});
	assert.deepEqual(
		updates.map(u => u.updateType),
		['rollback', 'replacement']
	);
	assert.equal(updates[0].releaseTimestamp, date);
	return {
		npm: [
			{
				packageFile: 'package.json',
				deps: [{ ...original, registryUrl, updates }],
			},
		],
	};
};
for (const [date, expected] of [
	[oldDate, ['rollback', 'replacement']],
	[new Date(now).toISOString(), []],
]) {
	const report = npmReport(date);
	const names = [];
	const published = await lookupNpmDates(report, async url => {
		const name = decodeURIComponent(new URL(url).pathname.slice(1));
		names.push(name);
		return Response.json({
			name,
			versions: { '1.0.0': { version: '1.0.0' } },
			time: { '1.0.0': date },
		});
	});
	assert.deepEqual(names, ['next-example']);
	const rules = observationRules({}, now, base, report, published);
	const liveConfig = {
		...resolvedConfig,
		packageRules: [...effective.packageRules, ...rules],
	};
	const direct = async reports =>
		(await flattenUpdates(liveConfig, reports))
			.filter(u => !u.isLockFileMaintenance)
			.map(u => u.updateType);
	assert.deepEqual(await direct(npmReport(date)), expected);
	assert.deepEqual(
		await direct(npmReport(undefined, 'https://registry.example.org')),
		[]
	);
}
let privateRequests = 0;
await lookupNpmDates(npmReport(oldDate, 'https://registry.example.org'), () => {
	privateRequests++;
});
assert.equal(privateRequests, 0);
