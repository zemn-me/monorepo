import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GlobalConfig } from 'renovate/dist/config/global.js';
import { extractPackageFile as extractBazel } from 'renovate/dist/modules/manager/bazel-module/extract.js';
import { applyPackageRules } from 'renovate/dist/util/package-rules/index.js';

const config = JSON.parse(
	await readFile('.github/renovate-global.json', 'utf8')
);
const module = await readFile('MODULE.bazel', 'utf8');
const goMod = await readFile('go.mod', 'utf8');
GlobalConfig.set({ localDir: process.cwd() });

// GitHub publishes the release dates needed by our age policy; BCR does not.
const bazel = await extractBazel(module, 'MODULE.bazel', {});
assert(bazel?.deps.length, 'Bazel extraction must succeed');
for (const name of ['rules_go', 'rules_oci']) {
	const dependencies = bazel.deps.filter(dep => dep.depName === name);
	assert.equal(dependencies.length, 1);
	const configured = await applyPackageRules({
		...dependencies[0],
		packageName: dependencies[0].packageName ?? name,
		manager: 'bazel-module',
		packageRules: config.packageRules,
	});
	assert.equal(configured.datasource, 'github-releases');
	assert.equal(configured.packageName, `bazel-contrib/${name}`);
	assert.equal(configured.extractVersion, '^v(?<version>.*)$');
	if (name === 'rules_go') {
		assert.equal(configured.groupName, 'Go toolchain');
		assert.equal(
			configured.currentValue,
			goMod.match(/github\.com\/bazelbuild\/rules_go v([^\s]+)/)[1]
		);
	}
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

// Every browser and driver archive must move to the same Stable release.
const { extractPackageFile: extractRegex } = await import(
	'renovate/dist/modules/manager/custom/regex/index.js'
);
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
