import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Only releases whose dependency declaration pins the bytes can use local age.
// A version, tag, short SHA, or checksum calculated later by CI is insufficient.
const fullDigest =
	/^(?:[a-f0-9]{40}|(?:sha256:)?[a-f0-9]{64}|sha512:[a-f0-9]{128})$/;
const isDigest = value => typeof value === 'string' && fullDigest.test(value);
const updateTypes = new Set(['major', 'minor', 'patch', 'digest', 'pinDigest']);

export function observe(packageFiles, previous, now) {
	const observations = new Map();
	for (const [manager, files] of Object.entries(packageFiles)) {
		for (const { packageFile, deps } of files) {
			for (const dep of deps) {
				for (const update of dep.updates ?? []) {
					const { updateType, newDigest, newVersion, newValue } =
						update;
					if (update.releaseTimestamp || !updateTypes.has(updateType))
						continue;
					if (
						!isDigest(dep.currentDigest) &&
						updateType !== 'pinDigest'
					)
						continue;
					const scope = {
						manager,
						packageFile,
						datasource: dep.datasource,
						depName: dep.depName,
						packageName: dep.packageName ?? dep.depName,
						currentDigest: dep.currentDigest ?? null,
						currentValue: dep.currentValue ?? null,
						updateType,
					};
					const key = JSON.stringify({
						scope,
						registryUrl:
							update.registryUrl ?? dep.registryUrl ?? null,
						newVersion: newVersion ?? null,
						newValue: newValue ?? null,
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
			}
		}
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

export function observationRules(observations, now, config) {
	// Match the effective policy too. A stricter package rule must continue to win.
	const days = /^(\d+) days?$/.exec(config.minimumReleaseAge);
	const buffer = /^(\d+) minutes?$/.exec(config.minimumReleaseAgeBuffer);
	const wait =
		days && buffer
			? (Number(days[1]) * 1440 + Number(buffer[1])) * 60_000
			: Infinity;
	const groups = new Map();
	for (const [key, { digest, firstSeen }] of Object.entries(observations)) {
		if (now - firstSeen < wait) continue;
		const { scope, newVersion, newValue } = JSON.parse(key);
		const groupKey = JSON.stringify(scope);
		if (!groups.has(groupKey))
			groups.set(groupKey, { scope, lookup: [], resolved: [] });
		const group = groups.get(groupKey);
		const type = scope.updateType;
		const pin = equal('newDigest', digest);
		const target = [
			equal('newVersion', newVersion),
			equal('newValue', newValue),
			pin,
		].join(' and ');
		group.resolved.push(`(${target})`);
		// Version selection precedes digest resolution for some registries. Renovate
		// reapplies package rules to the resolved pin before grouping or creating a branch.
		if (type === 'pinDigest') {
			// The initial pin is resolved after its lookup check. Verify it at branch selection.
			group.lookup.push('$not($exists(depIndex))');
		} else if (type === 'digest') {
			group.lookup.push(
				`$exists(updates[updateType = "${type}" and ${pin}])`
			);
		} else if (newVersion !== null) {
			group.lookup.push(
				`(${equal('version', newVersion)} and ($not($exists(newDigest)) or ${pin}))`
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
		const policy = {
			...fields,
			minimumReleaseAge: config.minimumReleaseAge,
			minimumReleaseAgeBuffer: config.minimumReleaseAgeBuffer,
			minimumReleaseAgeExtracted: null,
		};
		const condition = Object.entries(policy)
			.map(([field, value]) => equal(field, value))
			.join(' and ');
		const pinned = resolved.join(' or ');
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
	// Renovate exempts initial pins of unversioned refs from its native age check.
	// They can enter CI only after the observer has seen the SHA that will be written.
	rules.push({
		matchUpdateTypes: ['pinDigest'],
		matchJsonata: [
			[
				'$exists(depIndex)',
				equal('releaseTimestamp', null),
				...(approvedInitialPins.length
					? [`$not(${approvedInitialPins.join(' or ')})`]
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
			...observationRules(observations, now, config)
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
