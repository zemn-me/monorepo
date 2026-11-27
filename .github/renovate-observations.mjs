import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Only releases whose dependency declaration pins the bytes can use local age.
// A version, tag, short SHA, or checksum calculated later by CI is insufficient.
const fullDigest =
	/^(?:[a-f0-9]{40}|(?:sha256:)?[a-f0-9]{64}|sha512:[a-f0-9]{128})$/;
const isDigest = value => typeof value === 'string' && fullDigest.test(value);
// These direct dependency updates bypass upstream's native release-age lookup.
const nativeExempt = [
	'pin',
	'rollback',
	'replacement',
	'bump',
	'lockfileUpdate',
];
const updateTypes = new Set([
	'major',
	'minor',
	'patch',
	'digest',
	'pinDigest',
	...nativeExempt,
]);

function* candidates(packageFiles) {
	for (const [manager, files] of Object.entries(packageFiles)) {
		for (const { packageFile, deps } of files) {
			for (const dep of deps) {
				for (const update of dep.updates ?? []) {
					const scope = {
						manager,
						packageFile,
						datasource: dep.datasource,
						depName: dep.depName,
						packageName: dep.packageName ?? dep.depName,
						currentDigest: dep.currentDigest ?? null,
						currentValue: dep.currentValue ?? null,
						updateType: update.updateType,
					};
					const target = {
						newVersion: update.newVersion ?? null,
						newValue: update.newValue ?? null,
						newName: update.newName ?? null,
					};
					yield { dep, update, scope, target };
				}
			}
		}
	}
}

// Renovate omits the target timestamp for replacements. The public npm registry
// records publication time by exact version. Only query verified public names.
export async function lookupNpmDates(files, request = fetch) {
	const dates = new Map();
	const packages = new Map();
	const namespace = name => (name.startsWith('@') ? name.split('/')[0] : '');
	for (const { dep, update, scope } of candidates(files)) {
		if (
			scope.datasource !== 'npm' ||
			update.releaseTimestamp ||
			update.updateType !== 'replacement'
		)
			continue;
		const registryUrl = update.registryUrl ?? dep.registryUrl;
		if (
			registryUrl !== 'https://registry.npmjs.org' &&
			registryUrl !== 'https://registry.npmjs.org/'
		)
			continue;
		const name = update.newName ?? scope.packageName;
		if (
			typeof name !== 'string' ||
			typeof scope.packageName !== 'string' ||
			!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)
		)
			continue;
		// A different npm scope can have a different registry in the same checkout.
		if (namespace(name) !== namespace(scope.packageName)) continue;
		const version = update.newVersion ?? update.newValue;
		if (
			typeof version !== 'string' ||
			!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
				version
			) ||
			![version, '=' + version].includes(update.newValue)
		)
			continue;
		if (!packages.has(name)) packages.set(name, []);
		packages.get(name).push({ update, registryUrl, version });
	}
	for (const [name, targets] of packages) {
		let packument;
		try {
			const response = await request(
				`https://registry.npmjs.org/${encodeURIComponent(name)}`,
				{
					redirect: 'error',
					signal: AbortSignal.timeout(10_000),
				}
			);
			if (response.ok) packument = await response.json();
		} catch {
			// A failed lookup leaves only the ordinary digest fallback available.
		}
		if (packument?.name !== name) continue;
		for (const { update, registryUrl, version } of targets) {
			if (
				packument.versions?.[version]?.version === version &&
				typeof packument.time?.[version] === 'string'
			) {
				dates.set(update, {
					registryUrl,
					timestamp: packument.time[version],
				});
			}
		}
	}
	return dates;
}

export function observe(packageFiles, previous, now) {
	const observations = new Map();
	for (const { dep, update, scope, target } of candidates(packageFiles)) {
		const { updateType, newDigest } = update;
		if (update.releaseTimestamp || !updateTypes.has(updateType)) continue;
		if (!isDigest(dep.currentDigest) && updateType !== 'pinDigest')
			continue;
		const key = JSON.stringify({
			scope,
			target,
			registryUrl: update.registryUrl ?? dep.registryUrl ?? null,
		});
		// Two conflicting observations in one lookup cannot establish continuity.
		if (
			!isDigest(newDigest) ||
			(observations.has(key) &&
				observations.get(key)?.digest !== newDigest)
		) {
			observations.set(key, null);
			continue;
		}
		const old = previous[historyKey(key)];
		const same =
			old?.digest === newDigest &&
			Number.isSafeInteger(old.firstSeen) &&
			old.firstSeen >= 0 &&
			old.firstSeen <= now;
		observations.set(key, {
			digest: newDigest,
			firstSeen: same ? old.firstSeen : now,
		});
	}
	return Object.fromEntries(
		[...observations].filter(([, value]) => value !== null)
	);
}

// Artifacts only need the digest and clock. Keep package names and registry URLs
// in the current lookup rather than publishing them in workflow artifacts.
function historyKey(key) {
	return createHash('sha256').update(key).digest('hex');
}

export function history(observations) {
	return Object.fromEntries(
		Object.entries(observations).map(([key, entry]) => [
			historyKey(key),
			entry,
		])
	);
}

function equal(field, value) {
	return value === null
		? `($not($exists(${field})) or ${field} = null)`
		: `${field} = ${JSON.stringify(value)}`;
}

function matches(fields) {
	return Object.entries(fields)
		.map(([field, value]) => equal(field, value))
		.join(' and ');
}

export function observationRules(
	observations,
	now,
	config,
	files = {},
	npmDates = new Map()
) {
	// Match the effective policy too. A stricter package rule must continue to win.
	const days = /^(\d+) days?$/.exec(config.minimumReleaseAge);
	const buffer = /^(\d+) minutes?$/.exec(config.minimumReleaseAgeBuffer);
	const wait =
		days && buffer
			? (Number(days[1]) * 1440 + Number(buffer[1])) * 60_000
			: Infinity;
	const policy = {
		minimumReleaseAge: config.minimumReleaseAge,
		minimumReleaseAgeBuffer: config.minimumReleaseAgeBuffer,
		minimumReleaseAgeExtracted: null,
	};
	const approvedExempt = [];
	for (const { dep, update, scope, target } of candidates(files)) {
		if (!nativeExempt.includes(update.updateType)) continue;
		// A range pin freezes the resolved version. Only that exact version may
		// use its dependency timestamp; a rollback or replacement targets other code.
		const useCurrent =
			update.updateType === 'pin' &&
			target.newVersion &&
			target.newVersion === dep.currentVersion &&
			!update.releaseTimestamp;
		const field = useCurrent
			? 'currentVersionTimestamp'
			: 'releaseTimestamp';
		const registry = npmDates.get(update);
		const timestamp =
			registry?.timestamp ??
			(useCurrent
				? dep.currentVersionTimestamp
				: update.releaseTimestamp);
		if (
			typeof timestamp === 'string' &&
			/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(
				timestamp
			) &&
			Date.parse(timestamp) <= now - wait
		) {
			approvedExempt.push(
				`(${matches({ ...scope, ...target, newDigest: update.newDigest ?? null, ...policy, ...(registry ? { registryUrl: registry.registryUrl } : { [field]: timestamp }), ...(useCurrent ? { currentVersion: target.newVersion } : {}) })})`
			);
		}
	}
	const groups = new Map();
	for (const [key, { digest, firstSeen }] of Object.entries(observations)) {
		if (now - firstSeen < wait) continue;
		const { scope, target } = JSON.parse(key);
		const groupKey = JSON.stringify(scope);
		if (!groups.has(groupKey))
			groups.set(groupKey, { scope, lookup: [], resolved: [] });
		const group = groups.get(groupKey);
		const type = scope.updateType;
		const pin = equal('newDigest', digest);
		const resolved = `(${matches({ ...target, newDigest: digest })})`;
		group.resolved.push(resolved);
		if (nativeExempt.includes(type)) {
			approvedExempt.push(
				`(${matches({ ...scope, ...policy })} and ${resolved})`
			);
		}
		// Version selection precedes digest resolution for some registries. Renovate
		// reapplies package rules to the resolved pin before grouping or creating a branch.
		if (type === 'pinDigest') {
			// The initial pin is resolved after its lookup check. Verify it at branch selection.
			group.lookup.push('$not($exists(depIndex))');
		} else if (type === 'digest') {
			group.lookup.push(
				`$exists(updates[updateType = "${type}" and ${pin}])`
			);
		} else if (!nativeExempt.includes(type) && target.newVersion !== null) {
			group.lookup.push(
				`(${equal('version', target.newVersion)} and ($not($exists(newDigest)) or ${pin}))`
			);
		}
	}
	const rules = [];
	const approvedInitialPins = [];
	for (const { scope, lookup, resolved } of groups.values()) {
		const { datasource, updateType, ...fields } = scope;
		const match = {
			matchDatasources: [datasource],
			matchUpdateTypes: [updateType],
		};
		const condition = matches({ ...fields, ...policy, updateType });
		const pinned = resolved.join(' or ');
		if (nativeExempt.includes(updateType)) continue;
		if (updateType === 'pinDigest') {
			approvedInitialPins.push(
				`(datasource = ${JSON.stringify(datasource)} and ${condition} and (${pinned}))`
			);
		}
		rules.push(
			{
				...match,
				matchJsonata: [
					`${condition} and (${[...lookup, ...resolved].join(' or ')})`,
				],
				minimumReleaseAgeBehaviour: 'timestamp-optional',
			},
			{
				...match,
				matchJsonata: [
					`${condition} and $exists(depIndex) and $not(${pinned})`,
				],
				enabled: false,
			}
		);
	}
	// For a version-resolved initial pin the worker keeps the publication date
	// on the dependency, while its downstream branch check only sees the update.
	rules.push({
		matchUpdateTypes: ['pinDigest'],
		matchJsonata: [
			'$exists(depIndex) and $type(currentVersionTimestamp) = "string" and $not(pendingChecks = true)',
		],
		minimumReleaseAgeBehaviour: 'timestamp-optional',
	});
	// Renovate exempts initial pins of unversioned refs from its native age check.
	// They can enter CI only after the observer has seen the SHA that will be written.
	rules.push({
		matchUpdateTypes: ['pinDigest'],
		matchJsonata: [
			[
				'$exists(depIndex)',
				equal('releaseTimestamp', null),
				// This exists only on Renovate's version-resolved lookup path,
				// where its native check ages the newest matching release.
				equal('currentVersionTimestamp', null),
				...(approvedInitialPins.length
					? [`$not(${approvedInitialPins.join(' or ')})`]
					: []),
			].join(' and '),
		],
		enabled: false,
	});
	if (approvedExempt.length) {
		rules.push({
			matchUpdateTypes: nativeExempt,
			matchJsonata: [
				`$exists(depIndex) and (${approvedExempt.join(' or ')})`,
			],
			minimumReleaseAgeBehaviour: 'timestamp-optional',
		});
	}
	rules.push({
		matchUpdateTypes: nativeExempt,
		matchJsonata: [
			[
				'$exists(depIndex)',
				`updateType in ${JSON.stringify(nativeExempt)}`,
				...(approvedExempt.length
					? [`$not(${approvedExempt.join(' or ')})`]
					: []),
			].join(' and '),
		],
		enabled: false,
	});
	return rules;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const [reportPath, statePath, outputConfig] = process.argv.slice(2);
	const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
	const report = await readJson(reportPath);
	const previous = await readJson(statePath).catch(error => {
		if (error.code === 'ENOENT') return {};
		throw error;
	});
	const now = Date.now();
	const files =
		report.repositories[process.env.GITHUB_REPOSITORY]?.packageFiles;
	if (!files || !Object.keys(files).length)
		throw new Error('Renovate lookup returned no package files');
	const observations = observe(files, previous, now);
	const snapshot = history(observations);
	if (outputConfig) {
		const config = await readJson('.github/renovate-global.json');
		config.packageRules.push(
			...observationRules(
				observations,
				now,
				config,
				files,
				await lookupNpmDates(files)
			)
		);
		await writeFile(outputConfig, JSON.stringify(config));
	} else {
		// The update run can revoke continuity but cannot establish an observation
		// or set its clock. Only the read-only lookup starts a waiting period.
		for (const [key, entry] of Object.entries(snapshot)) {
			if (previous[key]?.digest !== entry.digest) delete snapshot[key];
		}
	}
	await writeFile(statePath, JSON.stringify(snapshot));
}
