import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GlobalConfig } from 'renovate/dist/config/global.js';
import { extractPackageFile as extractBazel } from 'renovate/dist/modules/manager/bazel-module/extract.js';
import { applyPackageRules } from 'renovate/dist/util/package-rules/index.js';

const config = JSON.parse(await readFile('.github/renovate-global.json', 'utf8'));
const module = await readFile('MODULE.bazel', 'utf8');
const goMod = await readFile('go.mod', 'utf8');
GlobalConfig.set({ localDir: process.cwd() });

// GitHub publishes the release dates needed by our age policy; BCR does not.
const bazel = await extractBazel(module, 'MODULE.bazel', {});
assert(bazel?.deps.length, 'Bazel extraction must succeed');
const rules = bazel.deps.filter(dep => dep.depName === 'rules_go');
assert.equal(rules.length, 1);
const resolved = await applyPackageRules({
	...rules[0],
	packageName: rules[0].packageName ?? rules[0].depName,
	manager: 'bazel-module',
	packageRules: config.packageRules,
});
assert.equal(resolved.datasource, 'github-releases');
assert.equal(resolved.packageName, 'bazel-contrib/rules_go');
assert.equal(resolved.extractVersion, '^v(?<version>.*)$');
assert.equal(resolved.groupName, 'Go toolchain');
assert.equal(
	rules[0].currentValue,
	goMod.match(/github\.com\/bazelbuild\/rules_go v([^\s]+)/)[1]
);

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
