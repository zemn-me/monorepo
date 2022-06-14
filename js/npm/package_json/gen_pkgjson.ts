import fs from 'fs/promises';
import { Command } from 'commander';

const depTypes = {
	skip: (v: string) => v === '@bazel/runfiles',
	isDev: (v: string) => v.startsWith('@types'),
};

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
			"The version of the package.json"
		)
		.requiredOption(
			'--query <path>',
			'The genquery (path) containing a list of line-break separated deps.'
		)
		.requiredOption(
			'--out <path>',
			'The output path of the generate package.json.'
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
	const pkg_json: {
		devDependencies: Record<string, string>;
		dependencies: Record<string, string>;
	} = JSON.parse(pkg_json_buf.toString());

	const all_deps = new Map([
		...Object.entries(pkg_json.dependencies),
		...Object.entries(pkg_json.devDependencies),
	]);

	const our_deps = [...all_deps]
		.filter(([k]) => pkgs.has(k))
		.filter(([pkg]) => !depTypes.skip(pkg));

	const runDeps = new Map<string, string>(),
		devDeps = new Map<string, string>();

	for (const [pkgName, pkgVersion] of our_deps) {
		[runDeps, devDeps][+depTypes.isDev(pkgName)].set(pkgName, pkgVersion);
	}

	const template = JSON.parse((await fs.readFile(opts.merge)).toString());
	const version = (await fs.readFile(opts.version)).toString();

	await fs.writeFile(
		opts.out,
		JSON.stringify(
			{
				version,
				...template,
				dependencies: Object.fromEntries(runDeps),
				devDependencies: Object.fromEntries(devDeps),
			},
			null,
			2
		)
	);
};

main().catch(e => console.error(e));
