import { JSONSchemaForNPMPackageJsonFiles as packageJson } from '@schemastore/package';
import { Command } from 'commander';
import fs from 'fs/promises';

const depTypes = {
	skip: (v: string) => v === '@bazel/runfiles',
	isDev: (v: string) => v.startsWith('@types'),
};

// Should be mostly identical to guard.must(guard.isDefined)
// re-implemented here because I don't want to fuck around
// with rules_nodejs's insane binary runtime.
//
// If you're in the future and I've finally ported to rules_js,
// you can remove this code and replace
// it with an import of ts/guard

function mustDefined<T>(v: T | undefined): T {
	if (v === undefined) throw new Error('Must be defined.');

	return v;
}

const labelToNpmPackage = (label: string): string => {
	/*
        Eventually, I should actually test this,
        @npm/:node_modules/@bazel/runfiles/LICENSE -> @bazel/runfiles
        @npm//@ok/thing:test.txt -> @ok/thing
        @npm//@ok/thing/file:test.txt -> @ok/thing
        @npm//ok-whatever:fuck -> ok-whatever
    */
	const match = /^@npm\/\/(?::node_modules\/)?((?:@[^/:]+\/)?[^/:]+)/.exec(
		label
	);

	if (match === null)
		throw new Error(`${label} does not appear to be an NPM package.`);

	return match[1];
};

interface GithubIssueUrlProps {
	title?: string;
	body?: string;
	labels?: string[];
}

const githubIssueUrl = (props: GithubIssueUrlProps) => {
	const params = new URLSearchParams();
	const modifiedProps = {
		...props,
		labels: props.labels?.map(s => s.replace(',', ''))?.join(','),
	};

	for (const [key, value] of Object.entries(modifiedProps)) {
		if (value) params.set(key, value);
	}

	const url = new URL('https://github.com/zemn-me/monorepo/issues/new');
	url.search = params.toString();
	return url.toString();
};

const main = async () => {
	const program = new Command()
		.name('gen_pkgjson')
		.description(
			'Generate a package.json for a bazel JS tree, using a genquery, ' +
				'a base package.json, and a template.'
		)
		.requiredOption(
			'--base <path>',
			"The 'base' package.json from which to draw package versions."
		)
		.requiredOption(
			'--merge <path>',
			"The 'template' package.json to merge deps into."
		)
		.requiredOption(
			'--version <version string>',
			'The version of the package.json'
		)
		.requiredOption(
			'--query <path>',
			'The genquery (path) containing a list of line-break separated deps.'
		)
		.requiredOption(
			'--out <path>',
			'The output path of the generate package.json.'
		)
		// this could be technically optional, but I do always
		// expect it to be specified in this context.
		.requiredOption(
			'--depOnlyOut <path>',
			'A path to output only the dep information to (used in version diffing).'
		)
		.requiredOption(
			'--package_name <path>',
			'The package_name within the monorepo.'
		)
		.parse(process.argv);

	const opts = program.opts();

	const deps_list = await fs.readFile(opts.query);
	const pkgs = new Set(
		deps_list
			.toString()
			.split('\n')
			.filter(v => v.startsWith('@npm//'))
			.map(v => labelToNpmPackage(v))
	);

	const pkg_json_buf = await fs.readFile(opts.base);

	// this could be less strict, but it resulted in crashes
	const pkg_json: packageJson = JSON.parse(pkg_json_buf.toString());

	const all_deps = new Map([
		...Object.entries(pkg_json.dependencies ?? []),
		...Object.entries(pkg_json.devDependencies ?? []),
	]);

	const our_deps = [...all_deps]
		.filter(([k]) => pkgs.has(k))
		.filter(([pkg]) => !depTypes.skip(pkg));

	const runDeps = new Map<string, string>(),
		devDeps = new Map<string, string>();

	for (const [pkgName, pkgVersion] of our_deps) {
		[runDeps, devDeps][+depTypes.isDev(pkgName)].set(
			pkgName,
			mustDefined(pkgVersion)
		);
	}

	const template = JSON.parse((await fs.readFile(opts.merge)).toString());
	const version = (await fs.readFile(opts.version)).toString();

	const depData = {
		dependencies: Object.fromEntries(runDeps),
		devDependencies: Object.fromEntries(devDeps),
	};

	const toMerge = {
		version,
		...depData,
		repository: {
			type: 'git',
			url: 'https://github.com/zemn-me/monorepo.git',
			directory: opts.package_name,
		},
		bugs: {
			url: githubIssueUrl({
				title: `//${opts.package_name}@${version}: something went wrong!`,
			}),
		},
	};

	const out: packageJson = {
		...template,
		...toMerge,
	};

	for (const key in toMerge)
		if (key in template)
			throw new Error(`Key ${key} must not be present in ${opts.merge}.`);

	await Promise.all([
		fs.writeFile(opts.out, JSON.stringify(out, null, 2)),
		fs.writeFile(opts.depOnlyOut, JSON.stringify(depData, null, 2)),
	]);
};

main().catch(e => {
	console.error(e);
	process.exit(1);
});
