import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Only releases whose dependency declaration pins the bytes can use local age.
// A version, tag, short SHA, or checksum calculated later by CI is insufficient.
const fullDigest =
	/^(?:[a-f0-9]{40}|(?:sha256:)?[a-f0-9]{64}|sha512:[a-f0-9]{128})$/;
function isDigest(value) {
	if (typeof value !== 'string') return false;
	if (fullDigest.test(value)) return true;
	const match = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/.exec(value);
	if (!match) return false;
	const bytes = Buffer.from(match[2], 'base64');
	return (
		bytes.length === Number(match[1].slice(3)) / 8 &&
		bytes.toString('base64') === match[2]
	);
}
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

// Git tag and commit dates can be set by the publisher. A date on a version
// that compares equal can also belong to a different SHA than the one written.
const gitDatasources = ['git-refs', 'github-digest', 'github-tags'];
const digestTypes = ['digest', 'pinDigest'];
function needsDigestProof({ manager, datasource, updateType, currentDigest }) {
	return (
		(manager === 'github-actions' && isDigest(currentDigest)) ||
		gitDatasources.includes(datasource) ||
		digestTypes.includes(updateType)
	);
}

function observationKey(scope, target, registryUrl) {
	return JSON.stringify({ scope, target, registryUrl: registryUrl ?? null });
}

export async function githubPublicationDates(files, request = fetch, token) {
	const dates = new Map();
	const cache = new Map();
	const headers = { Accept: 'application/vnd.github+json' };
	if (token) headers.Authorization = `Bearer ${token}`;
	const json = async url => {
		const response = await request(url, {
			headers,
			redirect: 'error',
			signal: AbortSignal.timeout(10_000),
		});
		return response.ok ? response.json() : null;
	};
	for (const { dep, update, scope, target } of candidates(files)) {
		if (
			scope.manager !== 'github-actions' ||
			!isDigest(update.newDigest) ||
			!gitDatasources.includes(scope.datasource)
		)
			continue;
		const registry = update.registryUrl ?? dep.registryUrl;
		if (
			registry &&
			!['https://github.com', 'https://github.com/'].includes(registry)
		)
			continue;
		if (
			typeof scope.packageName !== 'string' ||
			!/^[a-z\d_-]+\/[a-z\d_.-]+$/i.test(scope.packageName) ||
			scope.packageName
				.split('/')
				.some(part => part === '.' || part === '..')
		)
			continue;
		if (
			!registry &&
			dep.sourceUrl !== `https://github.com/${scope.packageName}`
		)
			continue;
		const tag = update.newValue ?? dep.currentValue;
		if (typeof tag !== 'string' || !tag || tag === '.' || tag === '..')
			continue;
		const repo = `https://api.github.com/repos/${scope.packageName}`;
		const path = `${repo}/releases/tags/${encodeURIComponent(tag)}`;
		if (!cache.has(path)) {
			let verified;
			try {
				const release = await json(path);
				if (
					release?.immutable === true &&
					release.draft === false &&
					release.tag_name === tag &&
					typeof release.published_at === 'string'
				) {
					const commit = await json(
						`${repo}/commits/${encodeURIComponent('refs/tags/' + tag)}`
					);
					if (isDigest(commit?.sha))
						verified = {
							digest: commit.sha,
							published: Date.parse(release.published_at),
						};
				}
			} catch {
				// Missing GitHub evidence leaves this SHA on the local clock.
			}
			cache.set(path, verified);
		}
		const proof = cache.get(path);
		if (
			proof?.digest === update.newDigest &&
			Number.isFinite(proof.published)
		) {
			dates.set(observationKey(scope, target, registry), proof.published);
		}
	}
	return dates;
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
		if (
			!updateTypes.has(updateType) ||
			(update.releaseTimestamp && !needsDigestProof(scope))
		)
			continue;
		if (!isDigest(dep.currentDigest) && updateType !== 'pinDigest')
			continue;
		const key = observationKey(
			scope,
			target,
			update.registryUrl ?? dep.registryUrl
		);
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
	npmDates = new Map(),
	githubDates = new Map()
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
		if (
			!nativeExempt.includes(update.updateType) ||
			needsDigestProof(scope)
		)
			continue;
		const registry = npmDates.get(update);
		const timestamp = registry?.timestamp ?? update.releaseTimestamp;
		if (
			typeof timestamp === 'string' &&
			/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(
				timestamp
			) &&
			Date.parse(timestamp) <= now - wait
		) {
			approvedExempt.push(
				`(${matches({ ...scope, ...target, newDigest: update.newDigest ?? null, ...policy, ...(registry ? { registryUrl: registry.registryUrl } : { releaseTimestamp: timestamp }) })})`
			);
		}
	}
	const groups = new Map();
	for (const [key, { digest, firstSeen }] of Object.entries(observations)) {
		if (now - (githubDates.get(key) ?? firstSeen) < wait) continue;
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
	const approvedPins = [];
	for (const { scope, lookup, resolved } of groups.values()) {
		const { datasource, updateType, ...fields } = scope;
		const match = {
			matchDatasources: [datasource],
			matchUpdateTypes: [updateType],
		};
		const condition = matches({ ...fields, ...policy, updateType });
		const pinned = resolved.join(' or ');
		if (needsDigestProof(scope)) {
			approvedPins.push(
				`(datasource = ${JSON.stringify(datasource)} and ${condition} and (${pinned}))`
			);
		}
		if (nativeExempt.includes(updateType)) continue;
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
	// Recheck the exact output before any branch can execute it. Native age
	// checks can use a different ref's timestamp even for a versioned initial pin.
	rules.push({
		matchJsonata: [
			[
				'$exists(depIndex)',
				`((manager = "github-actions" and $type(currentDigest) = "string") or updateType in ${JSON.stringify(digestTypes)} or datasource in ${JSON.stringify(gitDatasources)})`,
				...(approvedPins.length
					? [`$not(${approvedPins.join(' or ')})`]
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
				await lookupNpmDates(files),
				await githubPublicationDates(files, fetch, process.env.GH_TOKEN)
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
