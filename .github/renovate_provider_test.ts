import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Renovate publishes its internal APIs as JavaScript without declarations.
const renovate = (path: string) => import(`renovate/dist/${path}.js`);
const { init } = await renovate('logger/index');
await init();
const { getConfig } = await renovate('config/defaults');
const { GlobalConfig } = await renovate('config/global');
const { extractPackageFile } = await renovate('modules/manager/custom/regex/index');
const { branchifyUpgrades } = await renovate('workers/repository/updates/branchify');
const { doAutoReplace } = await renovate('workers/repository/update/branch/auto-replace');
const { updateDependency } = await renovate('modules/manager/npm/update/dependency/index');
const { extractPackageJson } = await renovate('modules/manager/npm/extract/common/package-file');

type Dependency = Record<string, unknown> & { depName: string; currentValue: string };
const config = JSON.parse(await readFile('.github/renovate-global.json', 'utf8'));
const module = await readFile('MODULE.bazel', 'utf8');
const manifest = await readFile('package.json', 'utf8');
const fixture = await mkdtemp(join(process.env.TEST_TMPDIR ?? tmpdir(), 'renovate-provider-'));
GlobalConfig.set({ localDir: fixture });
const manager = config.customManagers.find(
	(value: { description: string }) => value.description === 'Renovate directives'
);
const extracted = await extractPackageFile(module, 'MODULE.bazel', manager);
const providers: Dependency[] = extracted.deps.filter(
	(dep: Dependency) => ['@pulumi/aws', '@pulumi/random'].includes(dep.depName)
);
assert.equal(providers.length, 2, 'both native providers must be visible to Renovate');

// The observed AWS failure and a different provider/future major release use
// the real manager, branch grouping, and file-replacement implementations.
const branchNames = new Set<string>();
for (const [name, from, to] of [
	['@pulumi/aws', '7.54.0', '7.55.0'],
	['@pulumi/random', '4.21.6', '5.0.0'],
]) {
	assert(name && from && to);
	const provider = providers.find(dep => dep.depName === name);
	assert(provider);
	assert.equal(provider.datasource, 'npm');
	const current = provider.currentValue;
	const sourceModule = module.replace(provider.replaceString as string,
		(provider.replaceString as string).replace(current, from));
	const sourceManifest = JSON.stringify({ dependencies: { [name]: from } }, null, 2);
	const update = { newValue: to, newVersion: to,
		newMajor: Number(to.split('.')[0]),
		updateType: from.split('.')[0] === to.split('.')[0] ? 'minor' : 'major' };
	const providerDependency = { ...provider, packageName: name, currentValue: from,
		replaceString: (provider.replaceString as string).replace(current, from), updates: [update] };
	const sdk = extractPackageJson(JSON.parse(sourceManifest), 'package.json').deps
		.find((dep: Dependency) => dep.depName === name);
	assert(sdk);
	assert.equal(sdk.datasource, provider.datasource);
	const sdkDependency = { ...sdk, packageName: name, updates: [update] };
	const packageFiles = {
		regex: [{ ...extracted, packageFile: 'MODULE.bazel',
			deps: extracted.deps.map((dep: Dependency) => dep.depName === name
				? providerDependency : { ...dep, updates: [] }) }],
		npm: [{ packageFile: 'package.json', deps: [sdkDependency] }],
	};
	const options = { ...getConfig(), ...config, semanticCommits: 'disabled',
		lockFileMaintenance: { enabled: false }, errors: [], warnings: [], repoIsOnboarded: true };
	const { branches } = await branchifyUpgrades(options, packageFiles);
	assert.equal(branches.length, 1, 'SDK and provider must share a branch');
	const branch = branches[0];
	branchNames.add(branch.branchName);
	assert.equal(branch.upgrades.length, 2, 'group must retain both file occurrences');
	assert.equal(branch.minimumGroupSize, 2, 'a missing occurrence must block branch creation');
	let resultModule = sourceModule;
	let resultManifest = sourceManifest;
	for (const upgrade of branch.upgrades) {
		if (upgrade.packageFile === 'MODULE.bazel') {
			resultModule = await doAutoReplace(upgrade, resultModule, false);
		} else {
			resultManifest = updateDependency({ fileContent: resultManifest, upgrade });
		}
	}
	const result = await extractPackageFile(resultModule, 'MODULE.bazel', manager);
	assert.equal(result.deps.find((dep: Dependency) => dep.depName === name).currentValue, to);
	assert.equal(JSON.parse(resultManifest).dependencies[name], to);
	assert.equal(resultModule.includes(`PULUMI_${name.split('/')[1]?.toUpperCase()}_PROVIDER_VERSION = "${to}"`), true);
}

assert.equal(branchNames.size, 2, 'different providers must have independent update groups');

// Existing pins must agree with the SDK before considering any release update.
const packages = JSON.parse(manifest);
for (const provider of providers) {
	assert.equal(provider.currentValue,
		packages.dependencies?.[provider.depName] ?? packages.devDependencies?.[provider.depName]);
}
