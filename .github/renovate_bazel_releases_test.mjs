import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getConfig as getDefaults } from 'renovate/dist/config/defaults.js';
import { GlobalConfig } from 'renovate/dist/config/global.js';
import { mergeChildConfig } from 'renovate/dist/config/utils.js';
import { CustomDatasource } from 'renovate/dist/modules/datasource/custom/index.js';
import { extractPackageFile as extractBazel } from 'renovate/dist/modules/manager/bazel-module/extract.js';
import { checkMinimumReleaseAge } from 'renovate/dist/util/minimum-release-age.js';
import { applyPackageRules } from 'renovate/dist/util/package-rules/index.js';

const config = JSON.parse(
	await readFile('.github/renovate-global.json', 'utf8')
);
const module = await readFile('MODULE.bazel', 'utf8');
const goMod = await readFile('go.mod', 'utf8');
GlobalConfig.set({ localDir: process.cwd() });

const bazel = await extractBazel(module, 'MODULE.bazel', {});
assert(bazel?.deps.length, 'Bazel extraction must succeed');
const configure = dep => applyPackageRules({
	...dep,
	packageName: dep.depName,
	manager: 'bazel-module',
	minimumReleaseAge: config.minimumReleaseAge,
	packageRules: config.packageRules,
});
for (const name of ['aspect_rules_lint', 'rules_oci', 'rules_go']) {
	const dependencies = bazel.deps.filter(dep => dep.depName === name && dep.datasource === 'bazel');
	assert.equal(dependencies.length, 1);
	const dep = dependencies[0];
	const configured = await configure(dep);
	assert.equal(configured.datasource, 'custom.bcr');
	assert.equal(configured.versioning, 'bazel-module');
	assert.equal(configured.minimumReleaseAge, config.minimumReleaseAge);
	if (name === 'rules_go') {
		assert.equal(configured.groupName, 'Go toolchain');
		assert.equal(configured.currentValue, goMod.match(/github\.com\/bazelbuild\/rules_go v([^\s]+)/)[1]);
	}
}
const publicRegistry = 'https://bcr.bazel.build/';
const privateRegistry = 'https://registry.example.test';
const example = bazel.deps.find(dep => dep.depName === 'aspect_rules_lint');
const explicit = await configure({ ...example, registryUrls: [publicRegistry] });
assert.equal(explicit.datasource, 'custom.bcr');
assert.deepEqual(explicit.registryUrls, []);
for (const registryUrls of [[privateRegistry], [privateRegistry, publicRegistry]]) {
	const configured = await configure({ ...example, registryUrls });
	assert.equal(configured.datasource, 'bazel');
	assert.deepEqual(configured.registryUrls, registryUrls);
}

// Exercise the same custom datasource config merge and age check used by the bot.
const directory = await mkdtemp(join(tmpdir(), 'renovate-bcr-'));
try {
	GlobalConfig.set({ localDir: directory });
	const lookup = mergeChildConfig(config, {
		customDatasources: {
			bcr: { defaultRegistryUrlTemplate: 'file://{{packageName}}.json' },
		},
	});
	assert.deepEqual(lookup.customDatasources.chrome_stable, config.customDatasources.chrome_stable);
	await writeFile(join(directory, 'aspect_rules_lint.json'), JSON.stringify({ releases: [
		{ version: '1.0', releaseTimestamp: '2020-01-01T00:00:00Z' },
		{ version: '1.0.bcr.1', releaseTimestamp: new Date().toISOString() },
		{ version: '1.1' },
	] }));
	const result = await new CustomDatasource().getReleases({ ...lookup, ...explicit });
	const age = { ...getDefaults(), ...explicit, minimumReleaseAge: '3 days' };
	assert.deepEqual(result.releases.map(release => [
		release.version, checkMinimumReleaseAge(age, release.releaseTimestamp).isPending,
	]), [['1.0', false], ['1.0.bcr.1', true], ['1.1', true]]);
} finally {
	GlobalConfig.set({ localDir: process.cwd() });
	await rm(directory, { recursive: true, force: true });
}

// Updating the SDK without its build rules broke cgo response-file parsing.
for (const name of ['go', 'github.com/bazelbuild/rules_go']) {
	const grouped = await applyPackageRules({
		manager: 'gomod',
		depName: name,
		packageName: name,
		packageRules: config.packageRules,
	});
	assert.equal(grouped.groupName, 'Go toolchain');
}

const { extractPackageFile: extractRegex } = await import(
	'renovate/dist/modules/manager/custom/regex/index.js'
);
// The rules_oci archive override follows GitHub releases.
const releaseManager = config.customManagers.find(
	manager => manager.description === 'Renovate directives'
);
const releases = await extractRegex(module, 'MODULE.bazel', releaseManager);
const oci = releases.deps.filter(dep => dep.depName === 'bazel-contrib/rules_oci');
assert.equal(oci.length, 1);
assert.equal(oci[0].datasource, 'github-releases');
assert.equal(oci[0].extractVersion, '^v(?<version>.*)$');
assert.equal(oci[0].currentValue, module.match(/RULES_OCI_VERSION = "([^"]+)"/)[1]);
const configuredOci = await applyPackageRules({
	...oci[0],
	packageName: oci[0].depName,
	manager: 'custom.regex',
	minimumReleaseAge: config.minimumReleaseAge,
	packageRules: config.packageRules,
});
assert.equal(configuredOci.minimumReleaseAge, config.minimumReleaseAge);

// Every browser and driver archive must move to the same Stable release.
const chromeManager = config.customManagers.find(
	manager => manager.depNameTemplate === 'chrome-for-testing'
);
const chrome = await extractRegex(module, 'MODULE.bazel', chromeManager);
assert.equal(chrome.deps.length, 7);
assert.equal(new Set(chrome.deps.map(dep => dep.currentValue)).size, 1);
for (const dep of chrome.deps) {
	assert.equal(dep.datasource, 'custom.chrome_stable');
	const configured = await applyPackageRules({
		...dep,
		packageName: dep.depName,
		minimumReleaseAge: config.minimumReleaseAge,
		packageRules: config.packageRules,
	});
	assert.equal(configured.groupName, 'Chrome for Testing');
	assert.equal(configured.minimumReleaseAge, null);
}
assert.equal(
	config.customDatasources.chrome_stable.defaultRegistryUrlTemplate,
	'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json'
);
